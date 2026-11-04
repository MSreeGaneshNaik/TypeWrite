import SwiftUI

/// TypeWrite on the Mac and iPhone: the same machine as the browser version (web/ in this repository), in a native
/// window, with real haptics and the system share sheet. The page is Resources/TypeWrite.html, made by `npm run build` in web/.
@main
struct TypeWriteApp: App {
    var body: some Scene {
        WindowGroup {
            MachineView()
                .ignoresSafeArea()
                .statusBarHidden()
                #if targetEnvironment(macCatalyst)
                .onAppear(perform: MacWindow.configure)
                #endif
        }
    }
}

#if targetEnvironment(macCatalyst)
/// On a Mac the app runs as a resizable window: keep it tall enough for a sheet, with no title text in the title bar.
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
