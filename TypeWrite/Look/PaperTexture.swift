import SwiftUI
import UIKit

/// A seamless tile of specks, fibres and soft mottling, drawn once at launch
/// and laid over the paper colour with a multiply blend.
@MainActor
enum PaperTexture {
    static let tileSize: CGFloat = 384
    static let tile = Image(uiImage: makeTile())

    private static func makeTile() -> UIImage {
        let side = tileSize
        let format = UIGraphicsImageRendererFormat()
        format.scale = 2
        format.opaque = false
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format)

        return renderer.image { rendererContext in
            let cg = rendererContext.cgContext
            var random = SplitMix64(seed: 0xC1AC_5EED)

            func unit() -> CGFloat { CGFloat(random.unit()) }

            /// Draws at `point` and at its wrapped copies, so the tile has no seams.
            func wrapped(at point: CGPoint, reach: CGFloat, _ draw: (CGPoint) -> Void) {
                for dx in [-side, 0, side] {
                    for dy in [-side, 0, side] {
                        let copy = CGPoint(x: point.x + dx, y: point.y + dy)
                        if copy.x + reach < 0 || copy.x - reach > side || copy.y + reach < 0 || copy.y - reach > side {
                            continue
                        }
                        draw(copy)
                    }
                }
            }

            // Soft mottling.
            for _ in 0..<28 {
                let point = CGPoint(x: unit() * side, y: unit() * side)
                let radius = 24 + unit() * 60
                cg.setFillColor(UIColor(red: 0.42, green: 0.33, blue: 0.22, alpha: 0.012 + unit() * 0.014).cgColor)
                wrapped(at: point, reach: radius) { p in
                    cg.fillEllipse(in: CGRect(x: p.x - radius, y: p.y - radius, width: radius * 2, height: radius * 2))
                }
            }

            // Specks of pulp.
            for _ in 0..<2400 {
                let point = CGPoint(x: unit() * side, y: unit() * side)
                let radius = 0.2 + unit() * 0.7
                let warm = unit()
                cg.setFillColor(UIColor(red: 0.30 + warm * 0.15, green: 0.26 + warm * 0.08, blue: 0.20,
                                        alpha: 0.025 + unit() * 0.09).cgColor)
                wrapped(at: point, reach: radius) { p in
                    cg.fillEllipse(in: CGRect(x: p.x - radius, y: p.y - radius, width: radius * 2, height: radius * 2))
                }
            }

            // Fibres.
            cg.setLineCap(.round)
            for _ in 0..<130 {
                let point = CGPoint(x: unit() * side, y: unit() * side)
                let length = 4 + unit() * 12
                let angle = unit() * .pi * 2
                let bend = (unit() * 2 - 1) * 3
                let end = CGPoint(x: cos(angle) * length, y: sin(angle) * length)
                let control = CGPoint(x: end.x / 2 - sin(angle) * bend, y: end.y / 2 + cos(angle) * bend)
                cg.setStrokeColor(UIColor(red: 0.35, green: 0.29, blue: 0.21, alpha: 0.05 + unit() * 0.05).cgColor)
                cg.setLineWidth(0.35)
                wrapped(at: point, reach: length) { p in
                    cg.move(to: p)
                    cg.addQuadCurve(to: CGPoint(x: p.x + end.x, y: p.y + end.y),
                                    control: CGPoint(x: p.x + control.x, y: p.y + control.y))
                    cg.strokePath()
                }
            }
        }
    }
}
