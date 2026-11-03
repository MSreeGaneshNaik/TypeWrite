import SwiftData
import SwiftUI
#if targetEnvironment(macCatalyst)
import UIKit
#endif

@main
struct TypeWriteApp: App {
    init() {
        TypeFonts.registerBundledFonts()
    }

    var body: some Scene {
        WindowGroup {
            DeskView()
                .preferredColorScheme(.dark)
                #if targetEnvironment(macCatalyst)
                .onAppear(perform: MacWindow.configure)
                #endif
        }
        .modelContainer(for: PaperSheet.self)
    }
}

#if targetEnvironment(macCatalyst)
/// On a Mac the app runs as a resizable window: keep it tall enough for a sheet,
/// and let the dark desk run up under a title bar with no title text.
enum MacWindow {
    static func configure() {
        for case let scene as UIWindowScene in UIApplication.shared.connectedScenes {
            scene.title = "TypeWrite"
            scene.sizeRestrictions?.minimumSize = CGSize(width: 420, height: 640)
            if let titlebar = scene.titlebar {
                titlebar.titleVisibility = .hidden
                titlebar.toolbar = nil
            }
        }
    }
}
#endif
