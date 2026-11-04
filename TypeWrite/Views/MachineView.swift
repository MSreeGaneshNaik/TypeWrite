import SwiftUI
import UIKit
import WebKit

/// The machine: TypeWrite.html, full screen. The page calls into the app by name: "buzz" for a haptic,
/// "save" to hand a picture, the words or a letter to the share sheet, and "moved" once it has taken in
/// the sheets typed in the earlier, all-native app (see OldSheets).
struct MachineView: UIViewRepresentable {
    private static let calls = ["buzz", "save", "moved"]

    func makeCoordinator() -> Shell { Shell() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        for name in Self.calls { config.userContentController.add(context.coordinator, name: name) }
        if let old = OldSheets.json() {
            config.userContentController.addUserScript(WKUserScript(source: OldSheets.script(old), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = .black
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        #if DEBUG
        web.isInspectable = true
        #endif
        context.coordinator.web = web
        if let page = Bundle.main.url(forResource: "TypeWrite", withExtension: "html") {
            web.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
        }
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    static func dismantleUIView(_ web: WKWebView, coordinator: Shell) {
        // The content controller holds its handlers strongly: let go of them with the view.
        for name in calls { web.configuration.userContentController.removeScriptMessageHandler(forName: name) }
    }
}

/// Answers the page's calls into the app.
@MainActor
final class Shell: NSObject, WKScriptMessageHandler {
    weak var web: WKWebView?
    private let tap = UIImpactFeedbackGenerator(style: .rigid)
    private let knock = UIImpactFeedbackGenerator(style: .medium)
    private let warning = UINotificationFeedbackGenerator()

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {
        case "buzz": buzz(message.body)
        case "save": save(message.body)
        case "moved": OldSheets.markMoved()
        default: break
        }
    }

    /// The page asks for a vibration in milliseconds: a few for a key, ten or more for a return or a new sheet,
    /// and a pattern (an array) when the machine jams.
    private func buzz(_ body: Any) {
        if body is [Any] { warning.notificationOccurred(.error); return }
        let ms = (body as? NSNumber)?.doubleValue ?? 4
        if ms >= 10 { knock.impactOccurred(intensity: 0.9) } else { tap.impactOccurred(intensity: min(1, 0.3 + ms * 0.08)) }
    }

    /// A file from the page, as base64: written to a temporary file and offered to the share sheet on the iPhone
    /// (Save to Files, AirDrop, Messages, Mail) and to a save panel on the Mac.
    private func save(_ body: Any) {
        guard let file = body as? [String: Any], let name = file["name"] as? String, let base64 = file["data"] as? String,
              let data = Data(base64Encoded: base64), let web, let root = web.window?.rootViewController else { return }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent((name as NSString).lastPathComponent)
        do { try data.write(to: url, options: .atomic) } catch { return }
        var top = root
        while let shown = top.presentedViewController { top = shown }
        #if targetEnvironment(macCatalyst)
        top.present(UIDocumentPickerViewController(forExporting: [url], asCopy: true), animated: true)
        #else
        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = web
        sheet.popoverPresentationController?.sourceRect = CGRect(x: web.bounds.maxX - 40, y: web.safeAreaInsets.top + 30, width: 1, height: 1)
        top.present(sheet, animated: true)
        #endif
    }
}
