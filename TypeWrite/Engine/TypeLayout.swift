import Foundation

/// One character struck onto the sheet.
struct PlacedGlyph: Equatable, Sendable {
    /// The character as typed.
    let character: Character
    /// Position of the character in the sheet's source text. Ink jitter is
    /// seeded from this, so a glyph keeps its look even when a word wraps.
    let index: Int
    /// Column on its line, 0-based.
    let column: Int
}

/// One printed line of the sheet.
struct TypedLine: Equatable, Sendable {
    var glyphs: [PlacedGlyph] = []
    /// True when the line was ended by the Return key rather than by wrapping.
    var endsWithReturn = false
}

/// Where every glyph sits, plus where the type head will strike next.
struct SheetLayout: Equatable, Sendable {
    var lines: [TypedLine] = [TypedLine()]
    var caretLine = 0
    var caretColumn = 0

    static let empty = SheetLayout()
}

/// Lays typed text out on a fixed-pitch grid, the way a typewriter does.
///
/// Every character takes exactly one column. A line holds `columns`
/// characters; the next character wraps the word in progress onto a new line
/// (a word longer than a whole line is broken). A space that arrives at a full
/// line is absorbed by the line break, as a typist would hit Return instead.
enum TypeLayout {

    static func layout(_ text: String, columns: Int) -> SheetLayout {
        var layout = SheetLayout()
        var index = 0
        for character in text {
            _ = strike(character, index: index, into: &layout, columns: columns)
            index += 1
        }
        return layout
    }

    /// What happened to the carriage when a character was struck.
    enum Movement: Equatable {
        case advanced
        case returned
        case wrapped
        case wrappedOnSpace
    }

    /// Appends one character to `layout` and reports how the carriage moved.
    @discardableResult
    static func strike(_ character: Character, index: Int, into layout: inout SheetLayout, columns: Int) -> Movement {
        let width = max(columns, 1)

        if character == "\n" {
            layout.lines[layout.lines.count - 1].endsWithReturn = true
            layout.lines.append(TypedLine())
            layout.caretLine = layout.lines.count - 1
            layout.caretColumn = 0
            return .returned
        }

        var movement = Movement.advanced
        if layout.caretColumn >= width {
            if character == " " {
                layout.lines.append(TypedLine())
                layout.caretLine = layout.lines.count - 1
                layout.caretColumn = 0
                return .wrappedOnSpace
            }
            wrap(&layout)
            movement = .wrapped
        }

        let last = layout.lines.count - 1
        layout.lines[last].glyphs.append(PlacedGlyph(character: character, index: index, column: layout.caretColumn))
        layout.caretColumn += 1
        return movement
    }

    /// Starts a new line, carrying the unfinished word down with it.
    private static func wrap(_ layout: inout SheetLayout) {
        let last = layout.lines.count - 1
        let glyphs = layout.lines[last].glyphs
        var carried: [PlacedGlyph] = []

        if let space = glyphs.lastIndex(where: { $0.character == " " }), space < glyphs.count - 1 {
            carried = Array(glyphs[(space + 1)...])
            layout.lines[last].glyphs.removeSubrange((space + 1)...)
        }

        var line = TypedLine()
        for (column, glyph) in carried.enumerated() {
            line.glyphs.append(PlacedGlyph(character: glyph.character, index: glyph.index, column: column))
        }
        layout.lines.append(line)
        layout.caretLine = layout.lines.count - 1
        layout.caretColumn = carried.count
    }
}
