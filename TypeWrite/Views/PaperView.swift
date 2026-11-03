import SwiftUI

/// The sheet in the machine. The strike point stays still; the paper moves.
///
/// `shiftX` and `shiftY` are how far the carriage has carried the paper left
/// and up. They are animatable, so each keystroke slides the sheet one cell on
/// a spring and each Return swings it back and up a line, while new glyphs
/// appear instantly at the strike point.
struct PaperView: View, Animatable {
    var shiftX: CGFloat
    var shiftY: CGFloat
    var strikeY: CGFloat
    let strikeX: CGFloat
    let layout: SheetLayout
    let style: SheetStyle
    let texture: Image

    var animatableData: AnimatablePair<AnimatablePair<CGFloat, CGFloat>, CGFloat> {
        get { AnimatablePair(AnimatablePair(shiftX, shiftY), strikeY) }
        set {
            shiftX = newValue.first.first
            shiftY = newValue.first.second
            strikeY = newValue.second
        }
    }

    var body: some View {
        Canvas { context, size in
            let origin = CGPoint(
                x: strikeX - SheetMetrics.sideMargin - SheetMetrics.advance / 2 - shiftX,
                y: strikeY - style.topMargin - shiftY
            )
            SheetDrawing.draw(context, size: size, layout: layout, style: style,
                              paperOrigin: origin, paperHeight: nil, texture: texture)
        }
    }
}

/// A whole sheet scaled down for the desk.
struct SheetThumbnail: View {
    let text: String
    let style: SheetStyle
    let texture: Image

    var body: some View {
        let layout = TypeLayout.layout(String(text.prefix(1_400)), columns: SheetMetrics.columns)
        Canvas { context, size in
            guard size.width > 0, size.height > 0 else { return }
            let scale = size.width / SheetMetrics.paperWidth
            var page = context
            page.scaleBy(x: scale, y: scale)
            let pageSize = CGSize(width: size.width / scale, height: size.height / scale)
            SheetDrawing.draw(page, size: pageSize, layout: layout, style: style,
                              paperOrigin: .zero, paperHeight: pageSize.height, texture: texture, shadow: false)
        }
    }
}

/// The paper bail and type guide: a steel bar across the sheet with a cream
/// guide where the next letter lands. The guide's dots turn red once the bell
/// has rung for the margin.
struct CarriageRail: View {
    let nearMargin: Bool

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                Rectangle()
                    .fill(LinearGradient(colors: [Color(hex: 0xD0D3D8), Color(hex: 0x7E8289), Color(hex: 0x3C3F44)],
                                         startPoint: .top, endPoint: .bottom))
                    .frame(height: 10)
                LinearGradient(colors: [.black.opacity(0.3), .black.opacity(0)], startPoint: .top, endPoint: .bottom)
                    .frame(height: 5)
            }
            .offset(y: 2.5)

            HStack(spacing: 5) {
                ForEach(0..<3, id: \.self) { _ in
                    Circle().frame(width: 4.5, height: 4.5)
                }
            }
            .foregroundStyle(nearMargin ? Desk.alarm : Color(hex: 0x7A7268))
            .frame(width: 56, height: 22)
            .background(
                Capsule()
                    .fill(LinearGradient(colors: [Color(hex: 0xFAF5EA), Color(hex: 0xDCD0B8)],
                                         startPoint: .top, endPoint: .bottom))
                    .shadow(color: .black.opacity(0.45), radius: 3, y: 2)
            )
            .overlay(Capsule().strokeBorder(.black.opacity(0.18), lineWidth: 0.5))
            .offset(y: -1.5)

            Triangle()
                .fill(LinearGradient(colors: [Color(hex: 0xB9BDC3), Color(hex: 0x6E7279)],
                                     startPoint: .top, endPoint: .bottom))
                .frame(width: 9, height: 6)
                .offset(y: -15)
        }
        .frame(height: 26)
        .animation(.easeOut(duration: 0.15), value: nearMargin)
    }
}

struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

/// The platen roller the paper disappears under at the top.
struct RollerShade: View {
    var body: some View {
        LinearGradient(stops: [
            .init(color: Color(hex: 0x0E0D0B), location: 0),
            .init(color: Color(hex: 0x3B362F), location: 0.3),
            .init(color: Color(hex: 0x1A1815), location: 0.62),
            .init(color: .black.opacity(0), location: 1),
        ], startPoint: .top, endPoint: .bottom)
    }
}
