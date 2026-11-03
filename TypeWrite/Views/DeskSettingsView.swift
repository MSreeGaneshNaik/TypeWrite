import SwiftData
import SwiftUI

/// Paper, ribbon, typeface and pressed flower for the sheet in the machine.
/// Each choice also becomes the default for the next sheet.
struct DeskSettingsView: View {
    @Bindable var sheet: PaperSheet

    @Environment(\.dismiss) private var dismiss
    @AppStorage("soundOn") private var soundOn = true
    @AppStorage("hapticsOn") private var hapticsOn = true
    @AppStorage("defaultPaper") private var defaultPaper = Paper.cream.rawValue
    @AppStorage("defaultInk") private var defaultInk = Ink.black.rawValue
    @AppStorage("defaultTypeface") private var defaultTypeface = Typeface.courier.rawValue
    @AppStorage("defaultFlower") private var defaultFlower = FlowerKind.none.rawValue

    private let background = Color(hex: 0x1A1815)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    section("Paper") {
                        HStack(alignment: .top, spacing: 10) {
                            ForEach(Paper.allCases) { paper in
                                swatch(color: paper.color, name: paper.name, selected: sheet.paper == paper) {
                                    sheet.paper = paper
                                    defaultPaper = paper.rawValue
                                }
                            }
                        }
                    }

                    section("Ribbon") {
                        HStack(alignment: .top, spacing: 10) {
                            ForEach(Ink.allCases) { ink in
                                swatch(color: ink.color, name: ink.name, selected: sheet.ink == ink) {
                                    sheet.ink = ink
                                    defaultInk = ink.rawValue
                                }
                            }
                        }
                    }

                    section("Typeface") {
                        HStack(spacing: 12) {
                            ForEach(Typeface.allCases) { face in
                                typefaceTile(face)
                            }
                        }
                    }

                    section("Pressed flower") {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 12)], spacing: 12) {
                            ForEach(FlowerKind.allCases) { kind in
                                flowerTile(kind)
                            }
                        }
                    }

                    section("Machine") {
                        VStack(spacing: 0) {
                            Toggle("Key sounds", isOn: $soundOn)
                                .padding(.vertical, 10)
                            Divider().overlay(Color.white.opacity(0.08))
                            Toggle("Key taps", isOn: $hapticsOn)
                                .padding(.vertical, 10)
                        }
                        .font(Desk.type(15))
                        .foregroundStyle(Desk.cream)
                        .tint(Color(hex: 0xC9A15A))
                        Text("Sounds follow your silent switch.")
                            .font(Desk.type(11))
                            .foregroundStyle(Desk.faint)
                    }
                }
                .padding(20)
            }
            .background(background.ignoresSafeArea())
            .navigationTitle("The desk")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .font(Desk.type(16))
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationBackground(background)
        .preferredColorScheme(.dark)
    }

    // MARK: - Pieces

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title.uppercased())
                .font(Desk.type(11))
                .tracking(1.8)
                .foregroundStyle(Desk.faint)
            content()
        }
    }

    private func swatch(color: Color, name: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button {
            SoundBoard.shared.playKey()
            action()
        } label: {
            VStack(spacing: 8) {
                Circle()
                    .fill(color)
                    .frame(width: 42, height: 42)
                    .overlay(Circle().strokeBorder(.black.opacity(0.2), lineWidth: 0.5))
                    .padding(4)
                    .overlay(Circle().strokeBorder(selected ? Desk.cream : .clear, lineWidth: 2))
                Text(name)
                    .font(Desk.type(10))
                    .foregroundStyle(selected ? Desk.cream : Desk.faint)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(KeyPressStyle())
        .accessibilityLabel(name)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func typefaceTile(_ face: Typeface) -> some View {
        let selected = sheet.typeface == face
        return Button {
            SoundBoard.shared.playKey()
            sheet.typeface = face
            defaultTypeface = face.rawValue
        } label: {
            VStack(spacing: 6) {
                Text("Aa").font(face.font(scale: 1.6))
                Text(face.name).font(Desk.type(11))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .foregroundStyle(selected ? Color(hex: 0x1F1C19) : Desk.cream)
            .background(RoundedRectangle(cornerRadius: 12).fill(selected ? Desk.cream : Color.white.opacity(0.06)))
        }
        .buttonStyle(KeyPressStyle())
        .accessibilityLabel("\(face.name) typeface")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func flowerTile(_ kind: FlowerKind) -> some View {
        let selected = sheet.flower == kind
        return Button {
            SoundBoard.shared.playKey()
            sheet.flower = kind
            defaultFlower = kind.rawValue
        } label: {
            VStack(spacing: 6) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10).fill(sheet.paper.color)
                    if kind == .none {
                        Image(systemName: "circle.slash")
                            .font(.system(size: 20, weight: .light))
                            .foregroundStyle(Color(hex: 0x8C8475))
                    } else {
                        PressedFlowerView(kind: kind, seed: UInt64(bitPattern: Int64(sheet.seed)))
                            .padding(6)
                    }
                }
                .frame(height: 84)
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(selected ? Desk.cream : .clear, lineWidth: 2))
                Text(kind.name)
                    .font(Desk.type(11))
                    .foregroundStyle(selected ? Desk.cream : Desk.faint)
            }
        }
        .buttonStyle(KeyPressStyle())
        .accessibilityLabel(kind == .none ? "No flower" : kind.name)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}
