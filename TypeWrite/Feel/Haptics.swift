import UIKit

/// A small tap per key, a firmer knock on Return.
@MainActor
final class Haptics {
    static let shared = Haptics()

    var isEnabled = true

    private let keyTap = UIImpactFeedbackGenerator(style: .rigid)
    private let knock = UIImpactFeedbackGenerator(style: .medium)
    private let warning = UINotificationFeedbackGenerator()

    private init() {}

    func prepare() {
        keyTap.prepare()
        knock.prepare()
    }

    func key() {
        guard isEnabled else { return }
        keyTap.impactOccurred(intensity: 0.55)
        keyTap.prepare()
    }

    func space() {
        guard isEnabled else { return }
        keyTap.impactOccurred(intensity: 0.32)
        keyTap.prepare()
    }

    func carriageReturn() {
        guard isEnabled else { return }
        knock.impactOccurred(intensity: 0.9)
        knock.prepare()
    }

    func bell() {
        guard isEnabled else { return }
        knock.impactOccurred(intensity: 0.35)
    }

    func jammed() {
        guard isEnabled else { return }
        warning.notificationOccurred(.warning)
    }
}

/// Turns what the machine did into sound and touch.
@MainActor
enum Feedback {
    static func perform(_ events: [TypeEvent]) {
        for event in events {
            switch event {
            case .key:
                SoundBoard.shared.playKey()
                Haptics.shared.key()
            case .space:
                SoundBoard.shared.play(.space)
                Haptics.shared.space()
            case .bell:
                SoundBoard.shared.play(.bell)
                Haptics.shared.bell()
            case .carriageReturn:
                SoundBoard.shared.play(.carriageReturn)
                Haptics.shared.carriageReturn()
            case .backspace:
                SoundBoard.shared.play(.backspace)
                Haptics.shared.space()
            case .jammed:
                SoundBoard.shared.play(.jam)
                Haptics.shared.jammed()
            }
        }
    }
}
