import Observation

/// Observable wrapper around the typing engine for the typewriter screen.
@Observable
final class TypewriterModel {
    private(set) var core: TypistCore
    /// Bumped on every keystroke so the paper knows to move.
    private(set) var strokes = 0
    /// True when the last keystroke sent the carriage back.
    private(set) var lastWasReturn = false

    init(text: String) {
        core = TypistCore(text: text, columns: SheetMetrics.columns)
    }

    var layout: SheetLayout { core.layout }
    var text: String { core.text }

    /// True once the carriage is in the last few columns before the margin.
    var nearMargin: Bool { core.layout.caretColumn >= core.bellColumn }

    func type(_ input: String) -> [TypeEvent] {
        let events = core.type(input)
        register(events)
        return events
    }

    func backspace() -> [TypeEvent] {
        let events = core.backspace()
        register(events)
        return events
    }

    private func register(_ events: [TypeEvent]) {
        guard events != [.jammed] else { return }
        lastWasReturn = events.contains(.carriageReturn)
        strokes &+= 1
    }
}
