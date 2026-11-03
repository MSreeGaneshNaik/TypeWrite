import Foundation

/// Something the machine did that should be heard or felt.
enum TypeEvent: Equatable, Sendable {
    case key
    case space
    case bell
    case carriageReturn
    case backspace
    case jammed
}

/// The typewriter's state: the text on the sheet and where the carriage is.
///
/// Typing only ever appends, like a real machine. Backspace takes back the
/// last character. Everything that should make a sound comes back as events,
/// so the UI layer can play them without knowing any layout rules.
struct TypistCore: Equatable, Sendable {
    static let maxCharacters = 40_000

    private(set) var text: String
    private(set) var layout: SheetLayout
    private(set) var count: Int
    let columns: Int
    /// The bell rings when the carriage reaches this column.
    let bellColumn: Int

    init(text: String = "", columns: Int, bellOffset: Int = 6) {
        let width = max(columns, 8)
        self.columns = width
        self.bellColumn = max(width - bellOffset, 1)
        let clean = TypistCore.sanitize(text)
        self.text = clean
        self.count = clean.count
        self.layout = TypeLayout.layout(clean, columns: width)
    }

    /// Strikes typed input. A single key gives its own sounds; pasted text is
    /// laid down in one pass and sounds like one key.
    mutating func type(_ input: String) -> [TypeEvent] {
        let clean = TypistCore.sanitize(input)
        guard !clean.isEmpty else { return [] }
        guard count < TypistCore.maxCharacters else { return [.jammed] }

        let room = TypistCore.maxCharacters - count
        let accepted = clean.count > room ? String(clean.prefix(room)) : clean
        if accepted.count > 1 {
            for character in accepted {
                TypeLayout.strike(character, index: count, into: &layout, columns: columns)
                count += 1
            }
            text += accepted
            return [.key]
        }

        guard let character = accepted.first else { return [] }
        let before = layout
        let movement = TypeLayout.strike(character, index: count, into: &layout, columns: columns)
        count += 1
        text.append(character)

        var events: [TypeEvent] = []
        switch movement {
        case .returned, .wrappedOnSpace:
            events.append(.carriageReturn)
        case .wrapped:
            events.append(.carriageReturn)
            events.append(.key)
        case .advanced:
            events.append(character == " " ? .space : .key)
        }
        if layout.caretLine == before.caretLine,
           before.caretColumn < bellColumn, layout.caretColumn >= bellColumn {
            events.append(.bell)
        }
        return events
    }

    /// Takes back the last character.
    mutating func backspace() -> [TypeEvent] {
        guard !text.isEmpty else { return [.jammed] }
        text.removeLast()
        count -= 1
        layout = TypeLayout.layout(text, columns: columns)
        return [.backspace]
    }

    /// Typewriters print text, not control codes. Tabs become spaces, Windows
    /// and old Mac line endings become one Return.
    static func sanitize(_ input: String) -> String {
        var output = ""
        output.reserveCapacity(input.count)
        for character in input {
            switch character {
            case "\r\n", "\r", "\n", "\u{2028}", "\u{2029}":
                output.append("\n")
            case "\t":
                output.append("    ")
            default:
                if character.unicodeScalars.allSatisfy({ !CharacterSet.controlCharacters.contains($0) }) {
                    output.append(character)
                }
            }
        }
        return output
    }
}
