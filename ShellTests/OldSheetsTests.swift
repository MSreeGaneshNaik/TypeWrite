import JavaScriptCore
import XCTest
@testable import TypeWriteShell

/// The move of sheets from the earlier, all-native app into the page: run the script the app injects against a
/// stand-in localStorage, the way WebKit runs it before the page's own code.
final class OldSheetsTests: XCTestCase {
    private func page(holding sheets: String) -> JSContext {
        let js = JSContext()!
        js.evaluateScript("""
            var store = { "tw.sheets": \(sheets.debugDescription) }, told = 0;
            var localStorage = { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } };
            var window = { webkit: { messageHandlers: { moved: { postMessage: function () { told++; } } } } };
            """)
        return js
    }

    private func ids(_ js: JSContext) -> String {
        js.evaluateScript("JSON.parse(store['tw.sheets']).map(function (s) { return s.id; }).join(',')")!.toString()
    }

    func testOldSheetsJoinThePageOnceAndNothingIsLost() {
        let js = page(holding: #"[{"id":"a","text":"typed in the page"}]"#)
        let old = #"[{"id":"m1700000000000s7","text":"typed in the old app"}]"#
        js.evaluateScript(OldSheets.script(old))
        js.evaluateScript(OldSheets.script(old))   // the app was closed before it marked the move done: it runs again
        XCTAssertEqual(ids(js), "a,m1700000000000s7")
        XCTAssertEqual(js.evaluateScript("told")!.toInt32(), 2, "the app hears that the sheets arrived")
    }

    func testAPageWithNoSheetsYetTakesThemAll() {
        let js = page(holding: "")
        js.evaluateScript("delete store['tw.sheets'];")
        js.evaluateScript(OldSheets.script(#"[{"id":"x","text":"one"},{"id":"y","text":"two"}]"#))
        XCTAssertEqual(ids(js), "x,y")
    }
}
