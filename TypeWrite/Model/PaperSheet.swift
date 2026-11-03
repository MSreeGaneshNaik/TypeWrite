import Foundation
import SwiftData

/// One sheet of paper and everything typed on it.
@Model
final class PaperSheet {
    var createdAt: Date = Date.now
    var updatedAt: Date = Date.now
    var text: String = ""
    var paperRaw: String = Paper.cream.rawValue
    var inkRaw: String = Ink.black.rawValue
    var typefaceRaw: String = Typeface.courier.rawValue
    var flowerRaw: String = FlowerKind.none.rawValue
    /// Seeds the ink jitter and the flower's shape, so the sheet always looks the same.
    var seed: Int = 1

    init(paper: Paper, ink: Ink, typeface: Typeface, flower: FlowerKind) {
        createdAt = .now
        updatedAt = .now
        paperRaw = paper.rawValue
        inkRaw = ink.rawValue
        typefaceRaw = typeface.rawValue
        flowerRaw = flower.rawValue
        seed = Int.random(in: 1...Int(Int32.max))
    }

    var paper: Paper {
        get { Paper(rawValue: paperRaw) ?? .cream }
        set { paperRaw = newValue.rawValue }
    }

    var ink: Ink {
        get { Ink(rawValue: inkRaw) ?? .black }
        set { inkRaw = newValue.rawValue }
    }

    var typeface: Typeface {
        get { Typeface(rawValue: typefaceRaw) ?? .courier }
        set { typefaceRaw = newValue.rawValue }
    }

    var flower: FlowerKind {
        get { FlowerKind(rawValue: flowerRaw) ?? .none }
        set { flowerRaw = newValue.rawValue }
    }

    var style: SheetStyle {
        SheetStyle(paper: paper, ink: ink, typeface: typeface, flower: flower, seed: UInt64(seed))
    }

    var wordCount: Int {
        text.split(whereSeparator: { $0 == " " || $0 == "\n" }).count
    }
}
