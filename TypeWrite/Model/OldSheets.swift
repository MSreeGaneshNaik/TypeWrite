import Foundation
import SwiftData

/// Sheets typed in the earlier, all-native app move into the page once, in the shape the page stores them.
/// The old store is only read, never changed, so nothing is lost if the move is interrupted: it simply runs again.
enum OldSheets {
    private static let movedKey = "movedSheetsToPage"

    /// The old sheets as JSON, or nil when they have already moved or there are none.
    @MainActor
    static func json() -> String? {
        guard !UserDefaults.standard.bool(forKey: movedKey),
              let container = try? ModelContainer(for: PaperSheet.self),
              let sheets = try? container.mainContext.fetch(FetchDescriptor<PaperSheet>()) else { return nil }
        let ms = { (date: Date) in Int(date.timeIntervalSince1970 * 1000) }
        let list: [[String: Any]] = sheets.filter { !$0.text.isEmpty }.map { sheet in
            [
                // The id is made from when the sheet was started, so running the move twice never duplicates it.
                "id": "m\(ms(sheet.createdAt))s\(sheet.seed)", "text": sheet.text, "title": "",
                "created": ms(sheet.createdAt), "updated": ms(sheet.updatedAt),
                "paper": sheet.paperRaw, "ink": sheet.inkRaw, "face": sheet.typefaceRaw, "flower": sheet.flowerRaw,
                "size": "medium", "align": "left", "spacing": "half", "seed": max(1, sheet.seed % 2_147_483_646),
            ]
        }
        guard !list.isEmpty, let data = try? JSONSerialization.data(withJSONObject: list) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Runs before the page's own code: adds the old sheets to the page's list (skipping any already there),
    /// then tells the app, which marks the move done.
    static func script(_ json: String) -> String {
        """
        (function (old) {
          try {
            var mine = JSON.parse(localStorage.getItem("tw.sheets") || "[]"), have = {};
            mine.forEach(function (s) { have[s.id] = true; });
            old.forEach(function (s) { if (!have[s.id]) mine.push(s); });
            localStorage.setItem("tw.sheets", JSON.stringify(mine));
            window.webkit.messageHandlers.moved.postMessage(true);
          } catch (e) {}
        })(\(json));
        """
    }

    static func markMoved() { UserDefaults.standard.set(true, forKey: movedKey) }
}
