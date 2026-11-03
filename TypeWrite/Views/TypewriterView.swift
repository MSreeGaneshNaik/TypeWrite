import SwiftData
import SwiftUI

/// The machine: a sheet that moves past a fixed strike point.
struct TypewriterView: View {
    let sheet: PaperSheet

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage("soundOn") private var soundOn = true
    @AppStorage("hapticsOn") private var hapticsOn = true

    @State private var model: TypewriterModel
    @State private var typing = false
    /// How far the sheet has been dragged down to read earlier lines.
    @State private var review: CGFloat = 0
    @State private var reviewAtDragStart: CGFloat?
    /// Distance still to feed when a blank sheet rolls in.
    @State private var feed: CGFloat
    @State private var showingDesk = false
    @State private var shareItem: ShareItem?

    init(sheet: PaperSheet) {
        self.sheet = sheet
        _model = State(initialValue: TypewriterModel(text: sheet.text))
        _feed = State(initialValue: sheet.text.isEmpty ? 380 : 0)
    }

    var body: some View {
        let texture = PaperTexture.tile
        GeometryReader { geo in
            let strikeX = geo.size.width / 2
            let strikeY = max(geo.size.height * (typing ? 0.64 : 0.56), 150)
            // While typing, the carriage holds the paper at the next column.
            // While reading, the sheet slides to the centre so whole lines show.
            let readingShift = strikeX - SheetMetrics.sideMargin - SheetMetrics.advance / 2
                - (geo.size.width - SheetMetrics.paperWidth) / 2
            let shiftX = typing ? CGFloat(model.layout.caretColumn) * SheetMetrics.advance : readingShift

            ZStack(alignment: .top) {
                Desk.wood

                PaperView(
                    shiftX: shiftX,
                    shiftY: CGFloat(model.layout.caretLine) * SheetMetrics.lineHeight - review - feed,
                    strikeY: strikeY,
                    strikeX: strikeX,
                    layout: model.layout,
                    style: sheet.style,
                    texture: texture
                )
                .animation(strokeAnimation, value: model.strokes)
                .contentShape(Rectangle())
                .gesture(reviewGesture)
                .onTapGesture { setTyping(!typing) }
                .accessibilityElement()
                .accessibilityLabel(model.text.isEmpty ? "Blank sheet" : model.text)
                .accessibilityHint(typing ? "Double-tap to stop typing" : "Double-tap to type")

                CarriageRail(nearMargin: model.nearMargin)
                    .frame(width: geo.size.width)
                    .position(x: strikeX, y: strikeY + 13)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)

                RollerShade()
                    .frame(height: 22)
                    .allowsHitTesting(false)
            }
        }
        .background(Desk.wood.ignoresSafeArea())
        .safeAreaInset(edge: .top, spacing: 0) { header }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if !typing { toolbar.transition(.move(edge: .bottom).combined(with: .opacity)) }
        }
        .background(alignment: .topLeading) {
            KeyCatcher(isFocused: $typing, onText: strike, onBackspace: takeBack)
                .frame(width: 1, height: 1)
                .opacity(0.01)
                .accessibilityHidden(true)
        }
        .toolbar(.hidden, for: .navigationBar)
        .animation(.easeOut(duration: 0.25), value: typing)
        .sheet(isPresented: $showingDesk) { DeskSettingsView(sheet: sheet) }
        .sheet(item: $shareItem) { item in
            ActivityView(items: [item.image]).ignoresSafeArea()
        }
        .onAppear(perform: appear)
        .onDisappear {
            typing = false
            try? modelContext.save()
        }
        .onChange(of: soundOn) { _, on in SoundBoard.shared.isEnabled = on }
        .onChange(of: hapticsOn) { _, on in Haptics.shared.isEnabled = on }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active { try? modelContext.save() }
        }
    }

    // MARK: - Pieces

    private var header: some View {
        HStack(spacing: 12) {
            KeyCapButton(systemImage: "chevron.left", label: "Back to the desk") { dismiss() }
            Spacer(minLength: 8)
            VStack(spacing: 3) {
                Text(sheet.createdAt.formatted(.dateTime.day().month(.abbreviated).year()).uppercased())
                    .font(Desk.type(11))
                    .tracking(1.6)
                    .foregroundStyle(Desk.label)
                Text(wordsLabel)
                    .font(Desk.type(11))
                    .foregroundStyle(Desk.faint)
                    .monospacedDigit()
            }
            Spacer(minLength: 8)
            if typing {
                KeyCapButton(systemImage: "keyboard.chevron.compact.down", label: "Stop typing") { setTyping(false) }
            } else {
                KeyCapButton(systemImage: "square.and.arrow.up", label: "Share this sheet", action: share)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 4)
        .padding(.bottom, 10)
        .background(Desk.roller.ignoresSafeArea(edges: .top))
    }

    private var toolbar: some View {
        HStack(spacing: 14) {
            Button {
                SoundBoard.shared.playKey()
                setTyping(true)
            } label: {
                Label("Type", systemImage: "keyboard")
                    .font(Desk.type(16))
                    .foregroundStyle(Color(hex: 0x1F1C19))
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(Capsule().fill(Desk.cream).shadow(color: .black.opacity(0.5), radius: 6, y: 3))
            }
            .buttonStyle(KeyPressStyle())
            Spacer()
            KeyCapButton(systemImage: "slider.horizontal.3", label: "Paper, ribbon and flower") {
                showingDesk = true
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .background(Desk.roller.opacity(0.94).ignoresSafeArea(edges: .bottom))
    }

    private var wordsLabel: String {
        let words = model.text.split(whereSeparator: { $0 == " " || $0 == "\n" }).count
        return words == 1 ? "1 word" : "\(words) words"
    }

    private var strokeAnimation: Animation {
        if reduceMotion { return .easeOut(duration: 0.06) }
        return model.lastWasReturn
            ? .spring(response: 0.42, dampingFraction: 0.86)
            : .spring(response: 0.1, dampingFraction: 0.95)
    }

    private var reviewGesture: some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { value in
                if reviewAtDragStart == nil { reviewAtDragStart = review }
                let limit = CGFloat(model.layout.caretLine) * SheetMetrics.lineHeight + sheet.style.topMargin
                review = min(max((reviewAtDragStart ?? 0) + value.translation.height, 0), limit)
            }
            .onEnded { _ in reviewAtDragStart = nil }
    }

    // MARK: - Actions

    private func appear() {
        SoundBoard.shared.isEnabled = soundOn
        Haptics.shared.isEnabled = hapticsOn
        SoundBoard.shared.start()
        Haptics.shared.prepare()

        // Read before the feed animation sets `feed` to 0.
        let delay = feed > 0 ? 450 : 250
        if feed > 0 {
            SoundBoard.shared.play(.feed)
            withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(response: 0.8, dampingFraction: 0.9)) {
                feed = 0
            }
        }
        Task {
            try? await Task.sleep(for: .milliseconds(delay))
            setTyping(true)
        }
    }

    private func setTyping(_ on: Bool) {
        typing = on
        if on {
            Haptics.shared.prepare()
            if review != 0 {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.9)) { review = 0 }
            }
        }
    }

    private func strike(_ input: String) {
        record(model.type(input))
    }

    private func takeBack() {
        record(model.backspace())
    }

    private func record(_ events: [TypeEvent]) {
        Feedback.perform(events)
        if review != 0 { review = 0 }
        guard events != [.jammed] else { return }
        sheet.text = model.text
        sheet.updatedAt = .now
    }

    private func share() {
        guard let image = SheetExporter.image(text: model.text, style: sheet.style, texture: PaperTexture.tile) else { return }
        shareItem = ShareItem(image: image)
    }
}
