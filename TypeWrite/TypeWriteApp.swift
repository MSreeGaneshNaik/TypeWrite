import SwiftData
import SwiftUI

@main
struct TypeWriteApp: App {
    init() {
        TypeFonts.registerBundledFonts()
    }

    var body: some Scene {
        WindowGroup {
            DeskView()
                .preferredColorScheme(.dark)
        }
        .modelContainer(for: PaperSheet.self)
    }
}
