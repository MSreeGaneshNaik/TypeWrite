import SwiftUI
import UIKit

/// An invisible view that owns the keyboard. Unlike a text field it has no
/// cursor, selection, autocorrect or predictions: just keys, the way a
/// typewriter takes them. Works with hardware keyboards too.
struct KeyCatcher: UIViewRepresentable {
    @Binding var isFocused: Bool
    let onText: (String) -> Void
    let onBackspace: () -> Void

    func makeUIView(context: Context) -> KeyCatcherView {
        KeyCatcherView()
    }

    func updateUIView(_ view: KeyCatcherView, context: Context) {
        view.onText = onText
        view.onBackspace = onBackspace
        let binding = $isFocused
        view.onFocusChange = { focused in
            DispatchQueue.main.async {
                if binding.wrappedValue != focused { binding.wrappedValue = focused }
            }
        }
        if isFocused, !view.isFirstResponder {
            DispatchQueue.main.async { _ = view.becomeFirstResponder() }
        } else if !isFocused, view.isFirstResponder {
            DispatchQueue.main.async { _ = view.resignFirstResponder() }
        }
    }
}

final class KeyCatcherView: UIView, UIKeyInput {
    var onText: ((String) -> Void)?
    var onBackspace: (() -> Void)?
    var onFocusChange: ((Bool) -> Void)?

    // A typewriter: no corrections, no predictions, straight quotes.
    var autocorrectionType: UITextAutocorrectionType = .no
    var autocapitalizationType: UITextAutocapitalizationType = .none
    var spellCheckingType: UITextSpellCheckingType = .no
    var smartQuotesType: UITextSmartQuotesType = .no
    var smartDashesType: UITextSmartDashesType = .no
    var smartInsertDeleteType: UITextSmartInsertDeleteType = .no
    var inlinePredictionType: UITextInlinePredictionType = .no
    var keyboardType: UIKeyboardType = .default
    var keyboardAppearance: UIKeyboardAppearance = .dark
    var returnKeyType: UIReturnKeyType = .default

    override var canBecomeFirstResponder: Bool { true }

    /// Always true, so the delete key keeps firing even on a blank sheet.
    var hasText: Bool { true }

    func insertText(_ text: String) {
        onText?(text)
    }

    func deleteBackward() {
        onBackspace?()
    }

    @discardableResult
    override func becomeFirstResponder() -> Bool {
        let became = super.becomeFirstResponder()
        if became { onFocusChange?(true) }
        return became
    }

    @discardableResult
    override func resignFirstResponder() -> Bool {
        let resigned = super.resignFirstResponder()
        if resigned { onFocusChange?(false) }
        return resigned
    }

    // Command-V from a hardware keyboard.
    override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
        action == #selector(paste(_:))
    }

    override func paste(_ sender: Any?) {
        if let string = UIPasteboard.general.string {
            onText?(string)
        }
    }
}
