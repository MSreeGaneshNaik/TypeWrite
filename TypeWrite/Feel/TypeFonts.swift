import CoreText
import Foundation

enum TypeFonts {
    /// Registers the bundled typewriter faces so `Font.custom` can find them.
    static func registerBundledFonts() {
        for name in ["CourierPrime-Regular", "SpecialElite-Regular"] {
            let url = Bundle.main.url(forResource: name, withExtension: "ttf")
                ?? Bundle.main.url(forResource: name, withExtension: "ttf", subdirectory: "Fonts")
            guard let url else { continue }
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }
}
