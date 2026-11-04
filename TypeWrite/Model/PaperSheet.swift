import Foundation
import SwiftData

/// One sheet as the earlier, all-native app stored it. Kept only so OldSheets can read those sheets
/// and hand them to the page; the stored properties must stay exactly as they were for the store to open.
@Model
final class PaperSheet {
    var createdAt: Date = Date.now
    var updatedAt: Date = Date.now
    var text: String = ""
    var paperRaw: String = "cream"
    var inkRaw: String = "black"
    var typefaceRaw: String = "courier"
    var flowerRaw: String = "none"
    var seed: Int = 1

    init() {}
}
