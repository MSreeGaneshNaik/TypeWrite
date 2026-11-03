import SwiftUI

enum FlowerKind: String, CaseIterable, Identifiable {
    case none, marigold, rose, lavender, fern, daisy

    var id: String { rawValue }

    var name: String {
        switch self {
        case .none: "None"
        case .marigold: "Marigold"
        case .rose: "Rose"
        case .lavender: "Lavender"
        case .fern: "Fern"
        case .daisy: "Daisy"
        }
    }
}

/// A flower pressed flat between the pages, drawn from vector shapes.
struct PressedFlowerView: View {
    let kind: FlowerKind
    var seed: UInt64 = 7

    var body: some View {
        Canvas { context, size in
            PressedFlowerArt.draw(kind, in: context,
                                  center: CGPoint(x: size.width / 2, y: size.height / 2),
                                  size: min(size.width, size.height),
                                  rotation: .degrees(-16), seed: seed)
        }
        .accessibilityLabel(kind == .none ? "No flower" : "Pressed \(kind.name.lowercased())")
    }
}

/// Vector art for each pressed flower, drawn in a 100-point box centred on
/// the origin, then scaled and turned into place.
enum PressedFlowerArt {

    static func draw(_ kind: FlowerKind, in context: GraphicsContext, center: CGPoint,
                     size: CGFloat, rotation: Angle, seed: UInt64) {
        guard kind != .none else { return }
        var pen = context
        pen.translateBy(x: center.x, y: center.y)
        pen.rotate(by: rotation)
        pen.scaleBy(x: size / 100, y: size / 100)
        pen.opacity = 0.92
        var random = SplitMix64(seed: seed &+ 0x5EED)

        switch kind {
        case .none: break
        case .marigold: marigold(pen, &random)
        case .rose: rose(pen, &random)
        case .lavender: lavender(pen, &random)
        case .fern: fern(pen, &random)
        case .daisy: daisy(pen, &random)
        }
    }

    // MARK: - Flowers

    private static func marigold(_ pen: GraphicsContext, _ random: inout SplitMix64) {
        let head = CGPoint(x: 0, y: -16)
        let stalk = Curve(start: head, control: CGPoint(x: -10, y: 18), end: CGPoint(x: 8, y: 50))
        stem(pen, stalk, color: Color(hex: 0x6E7A42), width: 2.6)
        leaf(pen, on: stalk, at: 0.55, side: 1, length: 20, color: Color(hex: 0x74833F), vein: Color(hex: 0x56622E))
        leaf(pen, on: stalk, at: 0.76, side: -1, length: 16, color: Color(hex: 0x74833F), vein: Color(hex: 0x56622E))

        let rings: [(count: Int, length: CGFloat, fill: UInt32, edge: UInt32)] = [
            (17, 25, 0xD27A27, 0xA9561A),
            (12, 16, 0xE49438, 0xB86A1F),
        ]
        for ring in rings {
            let offset = random.cg() * .pi * 2
            for i in 0..<ring.count {
                let angle = offset + CGFloat(i) / CGFloat(ring.count) * .pi * 2 + random.cg(0.06)
                let length = ring.length * (0.88 + random.cg() * 0.22)
                let shape = place(petal(length: length, width: length * 0.28, roundness: 0.95), at: head, angle: angle)
                pen.fill(shape, with: .color(Color(hex: ring.fill, opacity: 0.85 + Double(random.cg()) * 0.15)))
                pen.stroke(shape, with: .color(Color(hex: ring.edge, opacity: 0.55)), lineWidth: 0.6)
            }
        }
        disc(pen, at: head, radius: 6, fill: 0x7A4216, dots: 0x5A3010, random: &random)
    }

    private static func rose(_ pen: GraphicsContext, _ random: inout SplitMix64) {
        let head = CGPoint(x: 0, y: -14)
        let stalk = Curve(start: head, control: CGPoint(x: 8, y: 16), end: CGPoint(x: -4, y: 50))
        stem(pen, stalk, color: Color(hex: 0x5C6B3A), width: 2.4)
        leaf(pen, on: stalk, at: 0.5, side: -1, length: 18, color: Color(hex: 0x63743D), vein: Color(hex: 0x46532A), roundness: 0.78, breadth: 0.42)
        leaf(pen, on: stalk, at: 0.72, side: 1, length: 15, color: Color(hex: 0x63743D), vein: Color(hex: 0x46532A), roundness: 0.78, breadth: 0.42)

        let layers: [(count: Int, length: CGFloat, breadth: CGFloat, fill: UInt32)] = [
            (6, 20, 0.62, 0xB4464E),
            (5, 13, 0.70, 0xA23A45),
        ]
        for layer in layers {
            let offset = random.cg() * .pi * 2
            for i in 0..<layer.count {
                let angle = offset + CGFloat(i) / CGFloat(layer.count) * .pi * 2 + random.cg(0.12)
                let length = layer.length + random.cg() * 4
                let shape = place(petal(length: length, width: length * layer.breadth, roundness: 0.98), at: head, angle: angle)
                pen.fill(shape, with: .color(Color(hex: layer.fill, opacity: 0.8)))
                pen.stroke(shape, with: .color(Color(hex: 0x8C2F3A, opacity: 0.5)), lineWidth: 0.5)
            }
        }

        var swirl = Path()
        var angle: CGFloat = random.cg() * .pi * 2
        var radius: CGFloat = 7.5
        swirl.move(to: CGPoint(x: head.x + cos(angle) * radius, y: head.y + sin(angle) * radius))
        while radius > 1 {
            angle += 0.35
            radius -= 0.3
            swirl.addLine(to: CGPoint(x: head.x + cos(angle) * radius, y: head.y + sin(angle) * radius))
        }
        pen.stroke(swirl, with: .color(Color(hex: 0x6E2230, opacity: 0.85)),
                   style: StrokeStyle(lineWidth: 1.1, lineCap: .round, lineJoin: .round))
    }

    private static func lavender(_ pen: GraphicsContext, _ random: inout SplitMix64) {
        let stalk = Curve(start: CGPoint(x: -6, y: -46), control: CGPoint(x: 5, y: 0), end: CGPoint(x: 2, y: 50))
        stem(pen, stalk, color: Color(hex: 0x76845A), width: 1.5)
        leaf(pen, on: stalk, at: 0.72, side: 1, length: 24, color: Color(hex: 0x8A9670), vein: Color(hex: 0x6B7652), breadth: 0.14)
        leaf(pen, on: stalk, at: 0.8, side: -1, length: 21, color: Color(hex: 0x8A9670), vein: Color(hex: 0x6B7652), breadth: 0.14)

        for step in 0..<13 {
            let t = 0.03 + CGFloat(step) * 0.034
            let point = stalk.point(t)
            let up = stalk.angle(t) + .pi
            let bud = 2.6 + CGFloat(step) * 0.11
            for side: CGFloat in [-1, 1] {
                let shape = place(petal(length: bud * 2.3, width: bud * 0.75, roundness: 0.9),
                                  at: point, angle: up + side * (0.5 + random.cg(0.12)))
                let tone: UInt32 = (step + Int(side)) % 2 == 0 ? 0x8C78B6 : 0x7A66A7
                pen.fill(shape, with: .color(Color(hex: tone, opacity: 0.9)))
            }
        }
        let tip = place(petal(length: 6, width: 2, roundness: 0.9), at: stalk.point(0), angle: stalk.angle(0) + .pi)
        pen.fill(tip, with: .color(Color(hex: 0x8C78B6)))
    }

    private static func fern(_ pen: GraphicsContext, _ random: inout SplitMix64) {
        let rachis = Curve(start: CGPoint(x: -4, y: -48), control: CGPoint(x: 10, y: 0), end: CGPoint(x: 4, y: 50))
        stem(pen, rachis, color: Color(hex: 0x5E7A40), width: 1.6)
        var t: CGFloat = 0.04
        while t < 0.9 {
            let point = rachis.point(t)
            let up = rachis.angle(t) + .pi
            let length = 4 + 22 * pow(t, 0.75)
            for side: CGFloat in [-1, 1] {
                let shape = place(petal(length: length, width: length * 0.2, roundness: 0.6),
                                  at: point, angle: up + side * (1.15 + random.cg(0.06)))
                pen.fill(shape, with: .color(Color(hex: 0x6E8D4C, opacity: 0.8 + Double(random.cg()) * 0.15)))
            }
            t += 0.055
        }
    }

    private static func daisy(_ pen: GraphicsContext, _ random: inout SplitMix64) {
        let head = CGPoint(x: 0, y: -14)
        let stalk = Curve(start: head, control: CGPoint(x: -6, y: 20), end: CGPoint(x: 6, y: 50))
        stem(pen, stalk, color: Color(hex: 0x6E7D46), width: 2.2)
        leaf(pen, on: stalk, at: 0.66, side: 1, length: 19, color: Color(hex: 0x75854A), vein: Color(hex: 0x56633A))

        let count = 20
        let offset = random.cg() * .pi * 2
        for i in 0..<count {
            let angle = offset + CGFloat(i) / CGFloat(count) * .pi * 2 + random.cg(0.05)
            let length = 22 + random.cg() * 3
            let shape = place(petal(length: length, width: 4.2, roundness: 0.97), at: head, angle: angle)
            pen.fill(shape, with: .color(Color(hex: 0xF8F4E8)))
            pen.stroke(shape, with: .color(Color(hex: 0xCBBFA4)), lineWidth: 0.7)
        }
        disc(pen, at: head, radius: 7, fill: 0xDDA52C, dots: 0xB07C17, random: &random)
    }

    // MARK: - Pieces

    private struct Curve {
        let start: CGPoint
        let control: CGPoint
        let end: CGPoint

        func point(_ t: CGFloat) -> CGPoint {
            let u = 1 - t
            return CGPoint(x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
                           y: u * u * start.y + 2 * u * t * control.y + t * t * end.y)
        }

        func angle(_ t: CGFloat) -> CGFloat {
            let u = 1 - t
            let dx = 2 * u * (control.x - start.x) + 2 * t * (end.x - control.x)
            let dy = 2 * u * (control.y - start.y) + 2 * t * (end.y - control.y)
            return atan2(dy, dx)
        }

        var path: Path {
            var path = Path()
            path.move(to: start)
            path.addQuadCurve(to: end, control: control)
            return path
        }
    }

    /// A petal or leaf lying along +x from the origin. Roundness near 1 gives a
    /// round tip, lower values a pointed one.
    private static func petal(length: CGFloat, width: CGFloat, roundness: CGFloat) -> Path {
        var path = Path()
        path.move(to: .zero)
        path.addCurve(to: CGPoint(x: length, y: 0),
                      control1: CGPoint(x: length * 0.3, y: -width),
                      control2: CGPoint(x: length * roundness, y: -width * 0.9))
        path.addCurve(to: .zero,
                      control1: CGPoint(x: length * roundness, y: width * 0.9),
                      control2: CGPoint(x: length * 0.3, y: width))
        path.closeSubpath()
        return path
    }

    private static func place(_ path: Path, at point: CGPoint, angle: CGFloat) -> Path {
        path.applying(CGAffineTransform(translationX: point.x, y: point.y).rotated(by: angle))
    }

    private static func stem(_ pen: GraphicsContext, _ curve: Curve, color: Color, width: CGFloat) {
        pen.stroke(curve.path, with: .color(color), style: StrokeStyle(lineWidth: width, lineCap: .round))
    }

    private static func leaf(_ pen: GraphicsContext, on curve: Curve, at t: CGFloat, side: CGFloat,
                             length: CGFloat, color: Color, vein: Color,
                             roundness: CGFloat = 0.62, breadth: CGFloat = 0.28) {
        let base = curve.point(t)
        let angle = curve.angle(t) + .pi + side * 0.8
        pen.fill(place(petal(length: length, width: length * breadth, roundness: roundness), at: base, angle: angle),
                 with: .color(color))
        var rib = Path()
        rib.move(to: .zero)
        rib.addLine(to: CGPoint(x: length * 0.85, y: 0))
        pen.stroke(place(rib, at: base, angle: angle), with: .color(vein), lineWidth: 0.7)
    }

    private static func disc(_ pen: GraphicsContext, at center: CGPoint, radius: CGFloat,
                             fill: UInt32, dots: UInt32, random: inout SplitMix64) {
        pen.fill(Path(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2)),
                 with: .color(Color(hex: fill)))
        for _ in 0..<10 {
            let angle = random.cg() * .pi * 2
            let distance = random.cg() * radius * 0.75
            let dot = CGRect(x: center.x + cos(angle) * distance - 0.8, y: center.y + sin(angle) * distance - 0.8,
                             width: 1.6, height: 1.6)
            pen.fill(Path(ellipseIn: dot), with: .color(Color(hex: dots, opacity: 0.8)))
        }
    }
}

private extension SplitMix64 {
    /// A value in 0..<1.
    mutating func cg() -> CGFloat { CGFloat(unit()) }
    /// A value in -range...range.
    mutating func cg(_ range: CGFloat) -> CGFloat { CGFloat(symmetric(Double(range))) }
}
