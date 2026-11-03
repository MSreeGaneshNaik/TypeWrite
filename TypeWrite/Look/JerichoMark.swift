import SwiftUI

/// The Jericho petal mark as a vector shape: eight quarter-circle leaves in a
/// square, top row facing in, bottom row mirrored. Same geometry as the
/// BloomType and Convmog marks (a 448-unit square).
///
/// The two middle leaves of each row touch edge to edge, so they are drawn as
/// one cup. That leaves no internal edge to show as a hairline seam.
struct JerichoMark: Shape {
    func path(in rect: CGRect) -> Path {
        var leaf = Path()
        leaf.move(to: CGPoint(x: 0, y: 0))
        leaf.addRelativeArc(center: CGPoint(x: 0, y: 112), radius: 112, startAngle: .degrees(-90), delta: .degrees(90))
        leaf.addLine(to: CGPoint(x: 112, y: 224))
        leaf.addRelativeArc(center: CGPoint(x: 112, y: 112), radius: 112, startAngle: .degrees(90), delta: .degrees(90))
        leaf.closeSubpath()

        var cup = Path()
        cup.move(to: CGPoint(x: 112, y: 0))
        cup.addRelativeArc(center: CGPoint(x: 112, y: 112), radius: 112, startAngle: .degrees(-90), delta: .degrees(90))
        cup.addRelativeArc(center: CGPoint(x: 336, y: 112), radius: 112, startAngle: .degrees(180), delta: .degrees(90))
        cup.addLine(to: CGPoint(x: 336, y: 112))
        cup.addRelativeArc(center: CGPoint(x: 224, y: 112), radius: 112, startAngle: .degrees(0), delta: .degrees(180))
        cup.closeSubpath()

        var top = leaf
        top.addPath(cup)
        top.addPath(leaf.applying(CGAffineTransform(a: -1, b: 0, c: 0, d: 1, tx: 448, ty: 0)))
        var mark = top
        mark.addPath(top.applying(CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: 448)))

        let side = min(rect.width, rect.height)
        let scale = side / 448
        return mark.applying(CGAffineTransform(
            a: scale, b: 0, c: 0, d: scale,
            tx: rect.midX - side / 2, ty: rect.midY - side / 2
        ))
    }
}
