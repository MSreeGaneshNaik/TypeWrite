import AVFoundation

/// Plays the machine's sounds with as little delay as iOS allows.
///
/// Every sample is decoded into memory at launch and played through a small
/// pool of always-attached players, so a keystroke never waits for a file or
/// a new node. Each play nudges the speed a few percent, so a hundred keys in
/// a row never sound like a loop.
@MainActor
final class SoundBoard {
    static let shared = SoundBoard()

    enum Sound: String, CaseIterable {
        case key1, key2, key3, key4, space, backspace, bell, carriageReturn = "return", feed, jam
    }

    var isEnabled = true

    private let engine = AVAudioEngine()
    private var buffers: [Sound: AVAudioPCMBuffer] = [:]
    /// Short sounds rotate through these.
    private var keyVoices: [Voice] = []
    /// Long sounds (bell, return, feed) get their own so fast typing never cuts them off.
    private var longVoices: [Voice] = []
    private var nextKeyVoice = 0
    private var nextLongVoice = 0
    private var lastKey: Sound?
    private var observers: [NSObjectProtocol] = []

    private struct Voice {
        let player: AVAudioPlayerNode
        let speed: AVAudioUnitVarispeed
    }

    private init() {
        load()
        build()
        observe()
    }

    func start() {
        // With no sounds loaded the engine has no nodes, and starting it would raise
        // an Objective-C exception that `try?` can't catch.
        guard !keyVoices.isEmpty else { return }
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        try? session.setPreferredIOBufferDuration(0.005)
        try? session.setActive(true)
        if !engine.isRunning {
            engine.prepare()
            try? engine.start()
        }
    }

    func playKey() {
        let keys: [Sound] = [.key1, .key2, .key3, .key4]
        var pick = keys.randomElement() ?? .key1
        if pick == lastKey { pick = keys[(keys.firstIndex(of: pick)! + 1) % keys.count] }
        lastKey = pick
        play(pick)
    }

    func play(_ sound: Sound) {
        guard isEnabled, let buffer = buffers[sound] else { return }
        if !engine.isRunning { start() }
        guard engine.isRunning else { return }

        let long = sound == .bell || sound == .carriageReturn || sound == .feed
        let voice: Voice
        if long {
            guard !longVoices.isEmpty else { return }
            voice = longVoices[nextLongVoice]
            nextLongVoice = (nextLongVoice + 1) % longVoices.count
        } else {
            guard !keyVoices.isEmpty else { return }
            voice = keyVoices[nextKeyVoice]
            nextKeyVoice = (nextKeyVoice + 1) % keyVoices.count
        }

        let jitter: Float = sound == .bell ? 0.008 : 0.02
        voice.speed.rate = 1 + Float.random(in: -jitter...jitter)
        voice.player.stop()
        voice.player.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
        voice.player.play()
    }

    private func load() {
        for sound in Sound.allCases {
            let url = Bundle.main.url(forResource: sound.rawValue, withExtension: "wav")
                ?? Bundle.main.url(forResource: sound.rawValue, withExtension: "wav", subdirectory: "Sounds")
            guard let url,
                  let file = try? AVAudioFile(forReading: url),
                  let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat,
                                                frameCapacity: AVAudioFrameCount(file.length))
            else { continue }
            do {
                try file.read(into: buffer)
                buffers[sound] = buffer
            } catch {
                continue
            }
        }
    }

    private func build() {
        guard let format = buffers.values.first?.format else { return }
        func makeVoice() -> Voice {
            let voice = Voice(player: AVAudioPlayerNode(), speed: AVAudioUnitVarispeed())
            engine.attach(voice.player)
            engine.attach(voice.speed)
            engine.connect(voice.player, to: voice.speed, format: format)
            engine.connect(voice.speed, to: engine.mainMixerNode, format: format)
            return voice
        }
        keyVoices = (0..<6).map { _ in makeVoice() }
        longVoices = (0..<2).map { _ in makeVoice() }
        engine.mainMixerNode.outputVolume = 0.9
    }

    /// Restarts the engine after a call, Siri, or a route change (headphones).
    private func observe() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.restart() }
        })
        observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            guard raw == AVAudioSession.InterruptionType.ended.rawValue else { return }
            MainActor.assumeIsolated { self?.restart() }
        })
    }

    private func restart() {
        engine.stop()
        start()
    }
}
