import SwiftUI

/// Draws a sheet: paper, grain, pressed flower and every struck glyph.
/// Shared by the live typewriter, the desk thumbnails and image export, so a
/// sheet looks identical everywhere.
enum SheetDrawing {

    /// - Parameters:
    ///   - size: the visible area in the context's coordinates; lines outside it are skipped.
    ///   - paperOrigin: top-left corner of the sheet.
    ///   - paperHeight: the sheet's height, or nil for paper that runs past the bottom edge.
    static func draw(
        _ context: GraphicsContext,
        size: CGSize,
        layout: SheetLayout,
        style: SheetStyle,
        paperOrigin: CGPoint,
        paperHeight: CGFloat?,
        texture: Image,
        shadow: Bool = true
    ) {
        let width = SheetMetrics.paperWidth
        let height = paperHeight ?? max(size.height - paperOrigin.y + 240, 400)
        let rect = CGRect(x: paperOrigin.x, y: paperOrigin.y, width: width, height: height)
        let sheet = Path(rect)

        if shadow {
            // Layered soft edges instead of a blur filter: cheap enough to redraw every frame.
            let layers: [(CGFloat, Double)] = [(16, 0.05), (9, 0.08), (4, 0.12), (1.5, 0.2)]
            for (spread, alpha) in layers {
                let shade = rect.insetBy(dx: -spread, dy: -spread).offsetBy(dx: 0, dy: spread * 0.45)
                context.fill(Path(roundedRect: shade, cornerRadius: spread), with: .color(.black.opacity(alpha)))
            }
        }

        context.fill(sheet, with: .color(style.paper.color))
        var grain = context
        grain.blendMode = .multiply
        grain.opacity = style.paper.grain
        grain.fill(sheet, with: .tiledImage(texture, origin: paperOrigin))
        context.stroke(sheet, with: .color(.black.opacity(0.08)), lineWidth: 0.75)

        if style.flower != .none {
            var random = SplitMix64(seed: style.seed ^ 0xF10E_F10E)
            // In the deeper top margin, clear of the first line.
            let center = CGPoint(x: rect.maxX - 70, y: rect.minY + 66)
            let tilt = -24 + random.symmetric(10)
            PressedFlowerArt.draw(style.flower, in: context, center: center, size: 104,
                                  rotation: .degrees(tilt), seed: style.seed)
        }

        drawText(context, size: size, layout: layout, style: style, paperOrigin: paperOrigin)
    }

    private struct Glyph {
        let text: GraphicsContext.ResolvedText
        let width: CGFloat
        let baseline: CGFloat
    }

    private static func drawText(
        _ context: GraphicsContext,
        size: CGSize,
        layout: SheetLayout,
        style: SheetStyle,
        paperOrigin: CGPoint
    ) {
        let lines = layout.lines
        let lineHeight = SheetMetrics.lineHeight
        let firstBaseline = paperOrigin.y + style.topMargin
        // Int() traps on NaN or infinity, which a zero-sized canvas can produce.
        guard size.height.isFinite, firstBaseline.isFinite, !lines.isEmpty else { return }
        let first = max(0, Int(((-lineHeight * 2 - firstBaseline) / lineHeight).rounded(.down)))
        let last = min(lines.count - 1, Int(((size.height + lineHeight * 2 - firstBaseline) / lineHeight).rounded(.down)))
        guard first <= last else { return }

        let font = style.typeface.font()
        let ink = style.ink.color
        var cache: [Character: Glyph] = [:]

        func glyph(for character: Character) -> Glyph {
            if let cached = cache[character] { return cached }
            var resolved = context.resolve(Text(String(character)).font(font))
            resolved.shading = .color(ink)
            let measured = resolved.measure(in: CGSize(width: 400, height: 400))
            let made = Glyph(text: resolved, width: measured.width, baseline: resolved.firstBaseline(in: measured))
            cache[character] = made
            return made
        }

        let left = paperOrigin.x + SheetMetrics.sideMargin
        for lineIndex in first...last {
            let baseline = firstBaseline + CGFloat(lineIndex) * lineHeight
            for placed in lines[lineIndex].glyphs where placed.character != " " {
                let shape = glyph(for: placed.character)
                let strike = InkJitter.strike(seed: style.seed, index: placed.index)
                let centerX = left + (CGFloat(placed.column) + 0.5) * SheetMetrics.advance

                var pen = context
                pen.translateBy(x: centerX + strike.dx, y: baseline + strike.dy)
                pen.rotate(by: .radians(strike.rotation))
                let corner = CGPoint(x: -shape.width / 2, y: -shape.baseline)

                // A faint second impression first, then the strike itself.
                pen.opacity = strike.bleed
                pen.draw(shape.text, at: CGPoint(x: corner.x + 0.45, y: corner.y + 0.2), anchor: .topLeading)
                pen.opacity = strike.opacity
                pen.draw(shape.text, at: corner, anchor: .topLeading)
            }
        }
    }
}
