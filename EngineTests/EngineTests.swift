import XCTest
@testable import TypeWriteEngine

private func lines(_ layout: SheetLayout) -> [String] {
    layout.lines.map { String($0.glyphs.map(\.character)) }
}

final class TypeLayoutTests: XCTestCase {

    func testShortLine() {
        let layout = TypeLayout.layout("abc", columns: 10)
        XCTAssertEqual(lines(layout), ["abc"])
        XCTAssertEqual(layout.caretLine, 0)
        XCTAssertEqual(layout.caretColumn, 3)
    }

    func testReturnStartsNewLine() {
        let layout = TypeLayout.layout("ab\ncd", columns: 10)
        XCTAssertEqual(lines(layout), ["ab", "cd"])
        XCTAssertTrue(layout.lines[0].endsWithReturn)
        XCTAssertFalse(layout.lines[1].endsWithReturn)
        XCTAssertEqual(layout.caretLine, 1)
        XCTAssertEqual(layout.caretColumn, 2)
    }

    func testTrailingReturnLeavesEmptyLine() {
        let layout = TypeLayout.layout("ab\n", columns: 10)
        XCTAssertEqual(lines(layout), ["ab", ""])
        XCTAssertEqual(layout.caretColumn, 0)
    }

    func testWordWrapCarriesUnfinishedWord() {
        let layout = TypeLayout.layout("hello world", columns: 8)
        XCTAssertEqual(lines(layout), ["hello ", "world"])
        XCTAssertEqual(layout.caretColumn, 5)
        XCTAssertEqual(layout.lines[1].glyphs.map(\.column), [0, 1, 2, 3, 4])
        XCTAssertEqual(layout.lines[1].glyphs.map(\.index), [6, 7, 8, 9, 10])
    }

    func testSpaceAtFullLineIsAbsorbed() {
        let layout = TypeLayout.layout("abcde f", columns: 5)
        XCTAssertEqual(lines(layout), ["abcde", "f"])
        XCTAssertEqual(layout.caretColumn, 1)
        XCTAssertEqual(layout.lines[1].glyphs[0].index, 6)
    }

    func testWordLongerThanLineIsBroken() {
        let layout = TypeLayout.layout("abcdefghij", columns: 4)
        XCTAssertEqual(lines(layout), ["abcd", "efgh", "ij"])
    }

    func testLineEndingInSpaceWrapsCleanly() {
        let layout = TypeLayout.layout("abcd efgh", columns: 5)
        XCTAssertEqual(lines(layout), ["abcd ", "efgh"])
    }

    func testColumnsNeverExceedWidth() {
        var random = SplitMix64(seed: 7)
        let alphabet = Array("ab cd ef\ngh ijklmnop  q")
        for _ in 0..<200 {
            let width = 4 + Int(random.next() % 30)
            let length = Int(random.next() % 300)
            let text = String((0..<length).map { _ in alphabet[Int(random.next() % UInt64(alphabet.count))] })
            let layout = TypeLayout.layout(text, columns: width)
            for line in layout.lines {
                XCTAssertLessThanOrEqual(line.glyphs.count, width)
                for (expected, glyph) in line.glyphs.enumerated() {
                    XCTAssertEqual(glyph.column, expected)
                }
            }
            // Every character is placed exactly once, except newlines and
            // spaces absorbed by a wrap.
            let placed = layout.lines.flatMap(\.glyphs).map(\.index)
            XCTAssertEqual(placed, placed.sorted())
            XCTAssertEqual(Set(placed).count, placed.count)
        }
    }
}

final class TypistCoreTests: XCTestCase {

    func testKeysAndSpaces() {
        var core = TypistCore(columns: 20)
        XCTAssertEqual(core.type("a"), [.key])
        XCTAssertEqual(core.type(" "), [.space])
        XCTAssertEqual(core.type("\n"), [.carriageReturn])
        XCTAssertEqual(core.text, "a \n")
    }

    func testBellRingsOnceWhenCrossingTheMargin() {
        var core = TypistCore(columns: 20, bellOffset: 6)
        var bells = 0
        for _ in 0..<19 {
            bells += core.type("x").filter { $0 == .bell }.count
        }
        XCTAssertEqual(core.bellColumn, 14)
        XCTAssertEqual(bells, 1)
    }

    func testAutomaticReturnOnWrap() {
        var core = TypistCore(columns: 8)
        for character in "hello wo" { _ = core.type(String(character)) }
        XCTAssertEqual(core.type("r"), [.carriageReturn, .key])
        XCTAssertEqual(core.layout.caretLine, 1)
    }

    func testIncrementalLayoutMatchesFullLayout() {
        var random = SplitMix64(seed: 42)
        let alphabet = Array("lorem ipsum dolor\nsit amet  ")
        for _ in 0..<50 {
            var core = TypistCore(columns: 12)
            for _ in 0..<Int(random.next() % 250) {
                let character = alphabet[Int(random.next() % UInt64(alphabet.count))]
                if random.next() % 9 == 0 {
                    _ = core.backspace()
                } else {
                    _ = core.type(String(character))
                }
            }
            XCTAssertEqual(core.layout, TypeLayout.layout(core.text, columns: 12))
            XCTAssertEqual(core.count, core.text.count)
        }
    }

    func testPasteSoundsLikeOneKey() {
        var core = TypistCore(columns: 10)
        XCTAssertEqual(core.type("a whole sentence pasted in"), [.key])
        XCTAssertEqual(core.layout, TypeLayout.layout(core.text, columns: 10))
    }

    func testBackspace() {
        var core = TypistCore(text: "ab", columns: 10)
        XCTAssertEqual(core.backspace(), [.backspace])
        XCTAssertEqual(core.text, "a")
        _ = core.backspace()
        XCTAssertEqual(core.backspace(), [.jammed])
    }

    func testSanitize() {
        XCTAssertEqual(TypistCore.sanitize("a\tb\r\nc\rd\u{0007}"), "a    b\nc\nd")
    }

    func testCapJamsTheMachine() {
        var core = TypistCore(text: String(repeating: "a", count: TypistCore.maxCharacters), columns: 30)
        XCTAssertEqual(core.type("b"), [.jammed])
    }
}

final class InkJitterTests: XCTestCase {

    func testDeterministic() {
        XCTAssertEqual(InkJitter.strike(seed: 99, index: 5), InkJitter.strike(seed: 99, index: 5))
        XCTAssertNotEqual(InkJitter.strike(seed: 99, index: 5), InkJitter.strike(seed: 99, index: 6))
    }

    func testRanges() {
        var light = 0
        for index in 0..<5000 {
            let strike = InkJitter.strike(seed: 1234, index: index)
            XCTAssertLessThanOrEqual(abs(strike.dx), 0.35)
            XCTAssertLessThanOrEqual(abs(strike.dy), 0.6)
            XCTAssertLessThanOrEqual(abs(strike.rotation), 1.1 * .pi / 180 + 1e-12)
            XCTAssert((0.5...1).contains(strike.opacity))
            XCTAssert((0...0.34).contains(strike.bleed))
            if strike.opacity < 0.66 { light += 1 }
        }
        // About 6% light strikes.
        XCTAssert((200...420).contains(light), "light strikes: \(light)")
    }
}
