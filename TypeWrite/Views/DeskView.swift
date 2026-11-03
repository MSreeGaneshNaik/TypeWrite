import SwiftData
import SwiftUI

/// Every sheet you've typed, laid out on the desk.
struct DeskView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \PaperSheet.updatedAt, order: .reverse) private var sheets: [PaperSheet]
    @State private var path: [PaperSheet] = []

    @AppStorage("defaultPaper") private var defaultPaper = Paper.cream.rawValue
    @AppStorage("defaultInk") private var defaultInk = Ink.black.rawValue
    @AppStorage("defaultTypeface") private var defaultTypeface = Typeface.courier.rawValue
    @AppStorage("defaultFlower") private var defaultFlower = FlowerKind.none.rawValue

    private let grid = [GridItem(.adaptive(minimum: 150, maximum: 220), spacing: 18)]

    var body: some View {
        let texture = PaperTexture.tile
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    masthead
                    if sheets.isEmpty {
                        emptyDesk
                    } else {
                        LazyVGrid(columns: grid, spacing: 24) {
                            ForEach(sheets) { sheet in
                                NavigationLink(value: sheet) {
                                    SheetCard(sheet: sheet, texture: texture)
                                }
                                .buttonStyle(.plain)
                                .contextMenu {
                                    Button("Throw away", systemImage: "trash", role: .destructive) {
                                        withAnimation { modelContext.delete(sheet) }
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 110)
            }
            .scrollIndicators(.hidden)
            .background(Desk.wood.ignoresSafeArea())
            .safeAreaInset(edge: .bottom) { feedButton }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: PaperSheet.self) { sheet in
                TypewriterView(sheet: sheet)
            }
        }
        .tint(Desk.cream)
        .onAppear(perform: pruneBlankSheets)
        .onChange(of: path) { _, newPath in
            guard newPath.isEmpty else { return }
            // Wait for the typewriter to finish leaving before tidying up.
            Task {
                try? await Task.sleep(for: .milliseconds(700))
                pruneBlankSheets()
            }
        }
    }

    private var masthead: some View {
        HStack(alignment: .center, spacing: 12) {
            // The app icon in miniature: the mark in ink on old cream paper.
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(RadialGradient(colors: [Color(hex: 0xF7EFDD), Color(hex: 0xEFE3C8), Color(hex: 0xD8C49E)],
                                     center: UnitPoint(x: 0.5, y: 0.42), startRadius: 2, endRadius: 34))
                .overlay(
                    JerichoMark()
                        .fill(LinearGradient(colors: [Color(hex: 0x2B2723), Color(hex: 0x0D0B09)],
                                             startPoint: .top, endPoint: .bottom))
                        .padding(8)
                )
                .frame(width: 42, height: 42)
                .shadow(color: .black.opacity(0.45), radius: 6, y: 3)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text("TypeWrite")
                    .font(.custom(Typeface.elite.postScriptName, fixedSize: 34))
                    .foregroundStyle(Desk.cream)
                Text("BY JERICHO")
                    .font(Desk.type(10.5))
                    .tracking(2)
                    .foregroundStyle(Desk.faint)
            }
            .accessibilityElement(children: .combine)
            Spacer()
            if !sheets.isEmpty {
                Text(sheets.count == 1 ? "1 sheet" : "\(sheets.count) sheets")
                    .font(Desk.type(12))
                    .foregroundStyle(Desk.faint)
            }
        }
        .padding(.top, 14)
    }

    private var emptyDesk: some View {
        VStack(spacing: 14) {
            Image(systemName: "doc")
                .font(.system(size: 34, weight: .light))
            Text("An empty desk.")
                .font(Desk.type(17))
                .foregroundStyle(Desk.label)
            Text("Feed a sheet and start typing.\nEvery key clacks. The bell rings\nnear the margin.")
                .font(Desk.type(13))
                .multilineTextAlignment(.center)
                .lineSpacing(4)
        }
        .foregroundStyle(Desk.faint)
        .frame(maxWidth: .infinity)
        .padding(.top, 110)
    }

    private var feedButton: some View {
        Button(action: feedNewSheet) {
            HStack(spacing: 10) {
                Image(systemName: "plus")
                Text("Feed a new sheet")
            }
            .font(Desk.type(16))
            .foregroundStyle(Color(hex: 0x1F1C19))
            .padding(.horizontal, 26)
            .padding(.vertical, 15)
            .background(Capsule().fill(Desk.cream).shadow(color: .black.opacity(0.55), radius: 10, y: 5))
        }
        .buttonStyle(KeyPressStyle())
        .frame(maxWidth: .infinity)
        .padding(.bottom, 10)
    }

    private func feedNewSheet() {
        let sheet = PaperSheet(
            paper: Paper(rawValue: defaultPaper) ?? .cream,
            ink: Ink(rawValue: defaultInk) ?? .black,
            typeface: Typeface(rawValue: defaultTypeface) ?? .courier,
            flower: FlowerKind(rawValue: defaultFlower) ?? .none
        )
        modelContext.insert(sheet)
        // Save first so the sheet has its permanent ID before it goes on the navigation path.
        try? modelContext.save()
        path.append(sheet)
    }

    /// Sheets fed and never typed on are thrown away.
    private func pruneBlankSheets() {
        for sheet in sheets where !path.contains(sheet)
            && sheet.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            modelContext.delete(sheet)
        }
    }
}

private struct SheetCard: View {
    let sheet: PaperSheet
    let texture: Image

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SheetThumbnail(text: sheet.text, style: sheet.style, texture: texture)
                .aspectRatio(1 / 1.294, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 3))
                .shadow(color: .black.opacity(0.45), radius: 9, y: 5)
            Text(sheet.updatedAt.formatted(.dateTime.day().month(.abbreviated).hour().minute()).uppercased())
                .font(Desk.type(10.5))
                .tracking(1.2)
                .foregroundStyle(Desk.faint)
            Text(firstLine)
                .font(Desk.type(12))
                .foregroundStyle(Desk.label)
                .lineLimit(1)
        }
        .accessibilityElement(children: .combine)
    }

    private var firstLine: String {
        let line = sheet.text.split(separator: "\n", omittingEmptySubsequences: true).first.map(String.init) ?? ""
        return line.trimmingCharacters(in: .whitespaces).isEmpty ? "Untitled sheet" : line
    }
}
