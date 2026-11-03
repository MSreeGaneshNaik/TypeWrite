import SwiftUI
import UIKit

/// A round typewriter key used for the app's buttons. It clacks when pressed.
struct KeyCapButton: View {
    let systemImage: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button {
            SoundBoard.shared.playKey()
            action()
        } label: {
            Image(systemName: systemImage)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color(hex: 0x2A2621))
                .frame(width: 40, height: 40)
                .background {
                    Circle()
                        .fill(RadialGradient(colors: [Color(hex: 0xFBF6EA), Color(hex: 0xE2D6BC)],
                                             center: UnitPoint(x: 0.4, y: 0.35), startRadius: 1, endRadius: 26))
                        .overlay(
                            Circle().strokeBorder(
                                LinearGradient(colors: [Color(hex: 0xEDEEEF), Color(hex: 0x6C6F75)],
                                               startPoint: .topLeading, endPoint: .bottomTrailing),
                                lineWidth: 3)
                        )
                        .shadow(color: .black.opacity(0.5), radius: 4, y: 2)
                }
        }
        .buttonStyle(KeyPressStyle())
        .accessibilityLabel(label)
    }
}

/// Keys sink a little when pressed.
struct KeyPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.93 : 1)
            .offset(y: configuration.isPressed ? 1.5 : 0)
            .animation(.spring(response: 0.15, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

/// The system share sheet.
struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

struct ShareItem: Identifiable {
    let id = UUID()
    let image: UIImage
}

/// Renders a whole sheet to an image for sharing.
@MainActor
enum SheetExporter {
    static func image(text: String, style: SheetStyle, texture: Image) -> UIImage? {
        let layout = TypeLayout.layout(text, columns: SheetMetrics.columns)
        let content = style.topMargin + CGFloat(layout.lines.count) * SheetMetrics.lineHeight + 70
        let height = max(content, SheetMetrics.paperWidth * 1.294)
        let page = Canvas { context, size in
            SheetDrawing.draw(context, size: size, layout: layout, style: style,
                              paperOrigin: .zero, paperHeight: size.height, texture: texture, shadow: false)
        }
        .frame(width: SheetMetrics.paperWidth, height: height)

        let renderer = ImageRenderer(content: page)
        renderer.scale = min(3, 14_000 / height)
        return renderer.uiImage
    }
}
