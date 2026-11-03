import SwiftUI

/// The fixed pitch of the machine. A sheet lays out the same on every device.
enum SheetMetrics {
    static let columns = 30
    static let advance: CGFloat = 10.2
    static let lineHeight: CGFloat = 26
    static let sideMargin: CGFloat = 26
    static let topMargin: CGFloat = 70
    /// A pressed flower sits above the first line, like a letterhead.
    static let flowerTopMargin: CGFloat = 138
    static var paperWidth: CGFloat { CGFloat(columns) * advance + sideMargin * 2 }
}

/// Everything about a sheet's look, in one value the drawing code can use.
struct SheetStyle: Equatable {
    var paper: Paper
    var ink: Ink
    var typeface: Typeface
    var flower: FlowerKind
    var seed: UInt64

    /// Room above the first line's baseline.
    var topMargin: CGFloat {
        flower == .none ? SheetMetrics.topMargin : SheetMetrics.flowerTopMargin
    }
}

enum Paper: String, CaseIterable, Identifiable {
    case cream, bright, kraft, onion

    var id: String { rawValue }

    var name: String {
        switch self {
        case .cream: "Cream laid"
        case .bright: "Bright bond"
        case .kraft: "Kraft"
        case .onion: "Onionskin"
        }
    }

    var color: Color {
        switch self {
        case .cream: Color(hex: 0xF1E8D4)
        case .bright: Color(hex: 0xF7F5EF)
        case .kraft: Color(hex: 0xD7C19D)
        case .onion: Color(hex: 0xE6E4DA)
        }
    }

    /// How strongly the fibre texture shows (drawing opacity, so at most 1).
    var grain: Double {
        switch self {
        case .cream: 0.8
        case .bright: 0.45
        case .kraft: 1
        case .onion: 0.6
        }
    }
}

enum Ink: String, CaseIterable, Identifiable {
    case black, red, blue, sepia

    var id: String { rawValue }

    var name: String {
        switch self {
        case .black: "Black ribbon"
        case .red: "Red ribbon"
        case .blue: "Blue ribbon"
        case .sepia: "Worn ribbon"
        }
    }

    var color: Color {
        switch self {
        case .black: Color(hex: 0x1F1C19)
        case .red: Color(hex: 0x9C2B22)
        case .blue: Color(hex: 0x25326C)
        case .sepia: Color(hex: 0x5A4636)
        }
    }
}

enum Typeface: String, CaseIterable, Identifiable {
    case courier, elite

    var id: String { rawValue }

    var name: String {
        switch self {
        case .courier: "Pica"
        case .elite: "Elite"
        }
    }

    var postScriptName: String {
        switch self {
        case .courier: "CourierPrime-Regular"
        case .elite: "SpecialElite-Regular"
        }
    }

    /// Point size that fills one cell of the fixed pitch.
    var size: CGFloat {
        switch self {
        case .courier: 17
        case .elite: 15.5
        }
    }

    func font(scale: CGFloat = 1) -> Font {
        .custom(postScriptName, fixedSize: size * scale)
    }
}

enum Desk {
    static let wood = Color(hex: 0x14120F)
    static let roller = Color(hex: 0x0E0D0B)
    static let cream = Color(hex: 0xEFE6D2)
    static let steel = Color(hex: 0x8D9096)
    static let alarm = Color(hex: 0xB5392D)
    static let label = Color(hex: 0xC9C0AE)
    static let faint = Color(hex: 0x8C8475)

    static func type(_ size: CGFloat) -> Font {
        .custom(Typeface.courier.postScriptName, fixedSize: size)
    }
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}
