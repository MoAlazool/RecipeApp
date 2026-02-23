import ActivityKit
import Foundation
import SwiftUI
import WidgetKit

struct LiveActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var title: String
    var subtitle: String?
    var timerEndDateInMilliseconds: Double?
    var progress: Double?
    var imageName: String?
    var dynamicIslandImageName: String?
    var isTimerDone: Bool?
  }

  var name: String
  var backgroundColor: String?
  var titleColor: String?
  var subtitleColor: String?
  var progressViewTint: String?
  var progressViewLabelColor: String?
  var deepLinkUrl: String?
  var timerType: DynamicIslandTimerType?
  var padding: Int?
  var paddingDetails: PaddingDetails?
  var imagePosition: String?
  var imageWidth: Int?
  var imageHeight: Int?
  var imageWidthPercent: Double?
  var imageHeightPercent: Double?
  var imageAlign: String?
  var contentFit: String?

  enum DynamicIslandTimerType: String, Codable {
    case circular
    case digital
  }

  struct PaddingDetails: Codable, Hashable {
    var top: Int?
    var bottom: Int?
    var left: Int?
    var right: Int?
    var vertical: Int?
    var horizontal: Int?
  }
}

struct LiveActivityPresentation {
  let recipeName: String
  let step: Int
  let total: Int

  var progress: Double {
    guard total > 0 else { return 0 }
    return min(max(Double(step) / Double(total), 0), 1)
  }

  init(subtitle: String?) {
    let parts = (subtitle ?? "").components(separatedBy: "||")
    let parsedRecipeName = parts.first?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    let stepInfo = parts.count > 1 ? parts[1] : ""

    let parsedNumbers = stepInfo
      .components(separatedBy: CharacterSet.decimalDigits.inverted)
      .compactMap(Int.init)

    let parsedStep = parsedNumbers.first ?? 1
    let parsedTotal = parsedNumbers.count > 1 ? parsedNumbers[1] : max(parsedStep, 1)

    recipeName = parsedRecipeName
    step = max(parsedStep, 1)
    total = max(parsedTotal, 1)
  }
}

private struct AppLogoView: View {
  let imageName: String?
  let size: CGFloat

  var body: some View {
    Group {
      if let imageName, !imageName.isEmpty {
        Image.dynamic(assetNameOrPath: imageName)
          .resizable()
          .scaledToFill()
          .frame(width: size, height: size)
          .clipShape(RoundedRectangle(cornerRadius: size * 0.25, style: .continuous))
          .overlay(
            RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
              .stroke(.white.opacity(0.15), lineWidth: 0.5)
          )
      } else {
        ZStack {
          RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
            .fill(Color(hex: "#D4AF37").opacity(0.15))

          Image(systemName: "fork.knife")
            .font(.system(size: size * 0.5, weight: .semibold))
            .foregroundStyle(Color(hex: "#D4AF37"))
        }
        .frame(width: size, height: size)
      }
    }
  }
}

struct LiveActivityWidget: Widget {

  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LiveActivityAttributes.self) { context in
      let presentation = LiveActivityPresentation(subtitle: context.state.subtitle)
      let resumePath = liveActivityResumePath(
        basePath: context.attributes.deepLinkUrl,
        stepIndex: max(presentation.step - 1, 0)
      )

      // Lock screen / notification center
      LiveActivityView(contentState: context.state, attributes: context.attributes)
        .activityBackgroundTint(Color.black)
        .activitySystemActionForegroundColor(.white)
        .applyWidgetURL(from: resumePath)

    } dynamicIsland: { context in
      let presentation = LiveActivityPresentation(subtitle: context.state.subtitle)
      let recipeName = presentation.recipeName.isEmpty ? context.attributes.name : presentation.recipeName
      let accentColor = accentColor(for: context.attributes)
      let progressValue = min(max(context.state.progress ?? presentation.progress, 0), 1)
      let iconName = context.state.dynamicIslandImageName ?? context.state.imageName
      let timerDate = context.state.timerEndDateInMilliseconds ?? 0
      let isDone = context.state.isTimerDone == true || (timerDate > 0 && (timerDate / 1000) <= (Date().timeIntervalSince1970 + 1.2))
      let compactStepCounterText = "\(presentation.step)/\(presentation.total)"
      let resumePath = liveActivityResumePath(
        basePath: context.attributes.deepLinkUrl,
        stepIndex: max(presentation.step - 1, 0)
      )

      return DynamicIsland {
        // ── Leading: compact step label ──
        DynamicIslandExpandedRegion(.leading) {
          Text("Step \(presentation.step)/\(presentation.total)")
            .font(.system(size: 13, weight: .bold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(.white.opacity(0.7))
            .applyWidgetURL(from: resumePath)
        }

        // ── Trailing: brand (timer is shown large in the bottom region) ──
        DynamicIslandExpandedRegion(.trailing) {
          Text("EITO")
            .font(.system(size: 13, weight: .black, design: .serif))
            .foregroundStyle(accentColor)
            .applyWidgetURL(from: resumePath)
        }

        // ── Bottom: all main content ──
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 10) {
            // Recipe name
            Text(recipeName)
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(.white.opacity(0.45))
              .lineLimit(1)

            // Instruction
            Text(context.state.title)
              .font(.system(size: 15, weight: .medium))
              .foregroundStyle(.white.opacity(0.9))
              .lineLimit(2)
              .fixedSize(horizontal: false, vertical: true)
              .frame(maxWidth: .infinity, alignment: .leading)

            // Timer (large, only when active)
            if timerDate > 0 {
              HStack {
                Spacer()
                if isDone {
                  HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                      .font(.system(size: 18))
                      .foregroundStyle(.green)
                    Text("Done")
                      .font(.system(size: 16, weight: .bold))
                      .foregroundStyle(.green)
                  }
                } else {
                  HStack(spacing: 6) {
                    Image(systemName: "timer")
                      .font(.system(size: 14, weight: .semibold))
                      .foregroundStyle(accentColor.opacity(0.7))
                    Text(timerInterval: Date.now...Date(timeIntervalSince1970: timerDate / 1000), countsDown: true)
                      .font(.system(size: 28, weight: .bold, design: .rounded))
                      .monospacedDigit()
                      .foregroundStyle(accentColor)
                  }
                }
                Spacer()
              }
            }

            // Progress bar
            GeometryReader { geo in
              ZStack(alignment: .leading) {
                Capsule()
                  .fill(.white.opacity(0.1))
                  .frame(height: 4)
                Capsule()
                  .fill(isDone ? .green : accentColor)
                  .frame(width: max(4, geo.size.width * progressValue), height: 4)
              }
            }
            .frame(height: 4)
          }
          .padding(.top, 6)
          .padding(.bottom, 6)
          .applyWidgetURL(from: resumePath)
        }
      } compactLeading: {
        // ── Compact leading: icon ──
        Group {
          if timerDate > 0 {
            if isDone {
              Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.green)
            } else {
              Image(systemName: "clock.fill")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(accentColor)
            }
          } else {
            AppLogoView(imageName: iconName, size: 20)
          }
        }
        .frame(width: 22, height: 22)
        .applyWidgetURL(from: resumePath)
      } compactTrailing: {
        // ── Compact trailing: timer or step ──
        ZStack(alignment: .trailing) {
          Text(compactStepCounterText)
            .font(.system(size: 12, weight: .bold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(.clear)
            .accessibilityHidden(true)

          Group {
            if timerDate > 0 {
              if isDone {
                Image(systemName: "checkmark")
                  .font(.system(size: 10, weight: .black))
                  .foregroundStyle(.green)
              } else {
                Text(timerInterval: Date.toTimerInterval(miliseconds: timerDate), countsDown: true)
                  .font(.system(size: 12, weight: .bold, design: .rounded))
                  .monospacedDigit()
                  .minimumScaleFactor(0.6)
                  .lineLimit(1)
                  .foregroundStyle(accentColor)
              }
            } else {
              Text(compactStepCounterText)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(.white.opacity(0.7))
            }
          }
          .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .fixedSize(horizontal: true, vertical: false)
        .frame(height: 22)
        .applyWidgetURL(from: resumePath)
      } minimal: {
        // ── Minimal: small icon ──
        AppLogoView(imageName: iconName, size: 24)
          .applyWidgetURL(from: resumePath)
      }
      .keylineTint(accentColor.opacity(0.3))
    }
  }

  private func accentColor(for attributes: LiveActivityAttributes) -> Color {
    attributes.progressViewTint.map { Color(hex: $0) } ?? Color(hex: "#D4AF37")
  }

  private func primaryTextColor(for attributes: LiveActivityAttributes) -> Color {
    attributes.titleColor.map { Color(hex: $0) } ?? Color(hex: "#201910")
  }

  private func backgroundTintColor(for attributes: LiveActivityAttributes) -> Color {
    attributes.backgroundColor.map { Color(hex: $0) } ?? Color(hex: "#FAF7F1")
  }

}

private let mealPlanWeekWidgetKind = "MealPlanWeekWidget"
private let mealPlanTodayWidgetKind = "MealPlanTodayWidget"
private let mealPlanWidgetGroupIdentifier = "group.com.moalazool.recipeapp"
private let mealPlanWidgetStorageKey = "mealPlanWidgetWeekV1"
private let mealPlanPlannerDeepLink = URL(string: "recipeapp://planner")
private let mealPlanSlotOrder = ["breakfast", "lunch", "dinner", "snack"]

private struct MealPlanWidgetMeal: Codable, Hashable {
  let slot: String
  let title: String
  let recipeId: String?
  let thumbnailUrl: String?
  let timeMinutes: Int?
  let calories: Int?
  let difficulty: String?
}

private struct MealPlanWidgetDay: Codable, Hashable, Identifiable {
  let date: String
  let filledSlots: Int
  let meals: [MealPlanWidgetMeal]

  var id: String { date }
}

private struct MealPlanWeekPayload: Codable {
  let version: Int
  let weekStart: String
  let generatedAt: Double
  let days: [MealPlanWidgetDay]
}

private struct MealPlanWeekEntry: TimelineEntry {
  let date: Date
  let payload: MealPlanWeekPayload?
}

private struct MealPlanTodayEntry: TimelineEntry {
  let date: Date
  let payload: MealPlanWeekPayload?
}

private struct MealPlanWeekProvider: TimelineProvider {
  func placeholder(in _: Context) -> MealPlanWeekEntry {
    MealPlanWeekEntry(date: Date(), payload: sampleMealPlanPayload())
  }

  func getSnapshot(in _: Context, completion: @escaping (MealPlanWeekEntry) -> Void) {
    completion(currentEntry())
  }

  func getTimeline(in _: Context, completion: @escaping (Timeline<MealPlanWeekEntry>) -> Void) {
    let entry = currentEntry()
    let refresh = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
    completion(Timeline(entries: [entry], policy: .after(refresh)))
  }

  private func currentEntry() -> MealPlanWeekEntry {
    MealPlanWeekEntry(date: Date(), payload: readMealPlanPayload())
  }
}

private struct MealPlanTodayProvider: TimelineProvider {
  func placeholder(in _: Context) -> MealPlanTodayEntry {
    MealPlanTodayEntry(date: Date(), payload: sampleMealPlanPayload())
  }

  func getSnapshot(in _: Context, completion: @escaping (MealPlanTodayEntry) -> Void) {
    completion(currentEntry())
  }

  func getTimeline(in _: Context, completion: @escaping (Timeline<MealPlanTodayEntry>) -> Void) {
    let now = Date()
    let entry = MealPlanTodayEntry(date: now, payload: readMealPlanPayload())
    let refresh = mealPlanNextFocusedSlotBoundary(after: now)
    completion(Timeline(entries: [entry], policy: .after(refresh)))
  }

  private func currentEntry() -> MealPlanTodayEntry {
    MealPlanTodayEntry(date: Date(), payload: readMealPlanPayload())
  }
}

struct MealPlanWeekWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: mealPlanWeekWidgetKind, provider: MealPlanWeekProvider()) { entry in
      MealPlanWeekWidgetView(entry: entry)
        .widgetURL(mealPlanPlannerDeepLink)
    }
    .configurationDisplayName("Meal Plan Week")
    .description("See your full week plan with meal cards.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct MealPlanTodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: mealPlanTodayWidgetKind, provider: MealPlanTodayProvider()) { entry in
      MealPlanTodayWidgetView(entry: entry)
        .widgetURL(mealPlanPlannerDeepLink)
    }
    .configurationDisplayName("Meal Plan Today")
    .description("See your full day meals with recipe images.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

private struct MealPlanWeekWidgetView: View {
  @Environment(\.widgetFamily) private var family

  let entry: MealPlanWeekEntry

  private var days: [MealPlanWidgetDay] {
    entry.payload?.days ?? []
  }

  var body: some View {
    Group {
      switch family {
      case .systemSmall:
        smallView
      default:
        mediumView
      }
    }
    .mealPlanWidgetBackground {
      Color(hex: "#F7F4EE")
    }
  }

  private var smallView: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Text("This Week")
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(Color(hex: "#2C241B"))
        Spacer()
        Text("\(days.reduce(0) { $0 + $1.filledSlots })")
          .font(.system(size: 11, weight: .bold, design: .rounded))
          .foregroundStyle(Color(hex: "#8A7C6B"))
      }

      if days.isEmpty {
        Text("Open Planner to sync meals")
          .font(.system(size: 12, weight: .medium))
          .foregroundStyle(Color(hex: "#8A7C6B"))
          .lineLimit(2)
      } else {
        ForEach(days.prefix(3)) { day in
          HStack(spacing: 7) {
            Circle()
              .fill(day.filledSlots > 0 ? Color(hex: "#D4AF37") : Color(hex: "#D4AF37").opacity(0.22))
              .frame(width: 6, height: 6)
            Text("\(weekdayLabel(from: day.date)) \(dayNumber(from: day.date))")
              .font(.system(size: 11, weight: .semibold))
              .foregroundStyle(Color(hex: "#5C4D3B"))
            Spacer(minLength: 6)
            Text("\(day.filledSlots)/4")
              .font(.system(size: 10, weight: .bold, design: .rounded))
              .foregroundStyle(Color(hex: "#8A7C6B"))
          }
        }
      }

      Spacer(minLength: 0)
    }
    .padding(12)
  }

  private var mediumView: some View {
    VStack(alignment: .leading, spacing: 8) {
      headerView

      if days.isEmpty {
        emptyWeekState
      } else {
        ForEach(days.prefix(3)) { day in
          HStack {
            Text("\(weekdayLabel(from: day.date)) \(dayNumber(from: day.date))")
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(Color(hex: "#2C241B"))
            Spacer()
            Text("\(day.filledSlots)/4")
              .font(.system(size: 11, weight: .semibold, design: .rounded))
              .foregroundStyle(Color(hex: "#736453"))
          }
          .padding(.horizontal, 9)
          .padding(.vertical, 7)
          .background(
            RoundedRectangle(cornerRadius: 9, style: .continuous)
              .fill(.white.opacity(0.75))
          )
        }
      }

      Spacer(minLength: 0)
    }
    .padding(12)
  }

  private var headerView: some View {
    HStack {
      Text("Week Plan")
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(Color(hex: "#2C241B"))

      Spacer()

      let totalMeals = days.reduce(0) { $0 + $1.filledSlots }
      Text("\(totalMeals) meals")
        .font(.system(size: 11, weight: .bold, design: .rounded))
        .foregroundStyle(Color(hex: "#7D705F"))
    }
  }

  private var emptyWeekState: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("No week plan")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(Color(hex: "#6E6153"))
      Text("Open Planner to sync.")
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(Color(hex: "#9A8D7E"))
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(10)
    .background(
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(.white.opacity(0.55))
    )
  }

  private func weekdayLabel(from dateString: String) -> String {
    guard let date = mealPlanDateFormatter.date(from: dateString) else { return "--" }
    return mealPlanWeekdayFormatter.string(from: date)
  }

  private func dayNumber(from dateString: String) -> String {
    guard let date = mealPlanDateFormatter.date(from: dateString) else { return "-" }
    return String(Calendar.current.component(.day, from: date))
  }
}

private struct MealPlanTodayWidgetView: View {
  @Environment(\.widgetFamily) private var family

  let entry: MealPlanTodayEntry

  private var days: [MealPlanWidgetDay] {
    entry.payload?.days ?? []
  }

  private var todayDay: MealPlanWidgetDay? {
    let todayKey = mealPlanDateFormatter.string(from: Date())
    return days.first(where: { $0.date == todayKey }) ?? days.first
  }

  private var mealsBySlot: [String: MealPlanWidgetMeal] {
    guard let day = todayDay else { return [:] }
    var map: [String: MealPlanWidgetMeal] = [:]
    for meal in day.meals {
      map[meal.slot] = meal
    }
    return map
  }

  private var focusedSlot: String {
    mealPlanFocusedSlot(for: entry.date)
  }

  private var focusedMeal: MealPlanWidgetMeal? {
    mealsBySlot[focusedSlot]
  }

  private var mediumSlots: [String] {
    Array(mealPlanSlotOrder.prefix(3))
  }

  var body: some View {
    Group {
      switch family {
      case .systemSmall:
        smallView
      case .systemLarge:
        largeView
      default:
        mediumView
      }
    }
    .mealPlanWidgetBackground {
      Color(hex: "#F7F4EE")
    }
  }

  private var smallView: some View {
    VStack(alignment: .leading, spacing: 8) {
      todayHeader

      if todayDay == nil {
        emptyTodayState
      } else {
        todaySimpleRow(slot: focusedSlot, meal: focusedMeal, showMeta: false)
      }
    }
    .padding(12)
  }

  private var mediumView: some View {
    VStack(alignment: .leading, spacing: 8) {
      todayHeader

      if todayDay == nil {
        emptyTodayState
      } else {
        ForEach(mediumSlots, id: \.self) { slot in
          todaySimpleRow(slot: slot, meal: mealsBySlot[slot], showMeta: false)
        }
      }
    }
    .padding(12)
  }

  private var largeView: some View {
    VStack(alignment: .leading, spacing: 8) {
      todayHeader

      if todayDay == nil {
        emptyTodayState
      } else {
        ForEach(mealPlanSlotOrder, id: \.self) { slot in
          todaySimpleRow(slot: slot, meal: mealsBySlot[slot], showMeta: true)
        }
      }

      Spacer(minLength: 0)
    }
    .padding(12)
  }

  private var todayHeader: some View {
    HStack {
      Text("Today Plan")
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(Color(hex: "#2C241B"))

      Spacer()

      Text("\(todayDay?.filledSlots ?? 0)/4")
        .font(.system(size: 11, weight: .bold, design: .rounded))
        .foregroundStyle(Color(hex: "#7D705F"))
    }
  }

  @ViewBuilder
  private func todaySimpleRow(slot: String, meal: MealPlanWidgetMeal?, showMeta: Bool) -> some View {
    let row = HStack(spacing: 9) {
      mealPlanThumbnail(meal, size: 34, cornerRadius: 8, fallbackSlot: slot)

      VStack(alignment: .leading, spacing: 2) {
        Text(mealPlanSlotLabel(from: slot))
          .font(.system(size: 10, weight: .semibold))
          .foregroundStyle(Color(hex: "#7A6C5D"))

        Text(meal?.title ?? "No meal planned")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(meal == nil ? Color(hex: "#978A7A") : Color(hex: "#2E2417"))
          .lineLimit(1)

        if showMeta, let meal {
          Text(mealMetaLine(meal))
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(Color(hex: "#877661"))
            .lineLimit(1)
        }
      }

      Spacer(minLength: 0)
    }
    .padding(.horizontal, 9)
    .padding(.vertical, showMeta ? 7 : 6)
    .background(
      RoundedRectangle(cornerRadius: 9, style: .continuous)
        .fill(.white.opacity(0.75))
    )

    if let url = mealPlanRecipeDeepLink(meal?.recipeId) {
      Link(destination: url) {
        row
      }
    } else {
      row
    }
  }

  private var emptyTodayState: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("No meals planned for today")
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(Color(hex: "#6E6153"))
      Text("Open Planner to add breakfast, lunch, dinner, and snack.")
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(Color(hex: "#9A8D7E"))
        .lineLimit(2)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(10)
    .background(
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(.white.opacity(0.55))
    )
  }
}

private func readMealPlanPayload() -> MealPlanWeekPayload? {
  guard
    let defaults = UserDefaults(suiteName: mealPlanWidgetGroupIdentifier),
    let raw = defaults.string(forKey: mealPlanWidgetStorageKey),
    let data = raw.data(using: .utf8)
  else {
    return nil
  }

  return try? JSONDecoder().decode(MealPlanWeekPayload.self, from: data)
}

private func sampleMealPlanPayload() -> MealPlanWeekPayload {
  MealPlanWeekPayload(
    version: 1,
    weekStart: "2026-02-09",
    generatedAt: Date().timeIntervalSince1970 * 1000,
    days: [
      MealPlanWidgetDay(
        date: "2026-02-09",
        filledSlots: 3,
        meals: [
          MealPlanWidgetMeal(slot: "breakfast", title: "Greek Yogurt Bowl", recipeId: "demo-a", thumbnailUrl: nil, timeMinutes: 8, calories: 320, difficulty: "beginner"),
          MealPlanWidgetMeal(slot: "lunch", title: "Chicken Salad Wrap", recipeId: "demo-b", thumbnailUrl: nil, timeMinutes: 20, calories: 520, difficulty: "beginner"),
          MealPlanWidgetMeal(slot: "dinner", title: "Garlic Pasta", recipeId: "demo-c", thumbnailUrl: nil, timeMinutes: 28, calories: 640, difficulty: "intermediate"),
        ]
      ),
      MealPlanWidgetDay(
        date: "2026-02-10",
        filledSlots: 2,
        meals: [
          MealPlanWidgetMeal(slot: "lunch", title: "Shrimp Rice Bowl", recipeId: "demo-d", thumbnailUrl: nil, timeMinutes: 30, calories: 560, difficulty: "intermediate"),
          MealPlanWidgetMeal(slot: "dinner", title: "Miso Salmon", recipeId: "demo-e", thumbnailUrl: nil, timeMinutes: 25, calories: 600, difficulty: "intermediate"),
        ]
      ),
      MealPlanWidgetDay(date: "2026-02-11", filledSlots: 1, meals: [MealPlanWidgetMeal(slot: "dinner", title: "Lentil Soup", recipeId: "demo-f", thumbnailUrl: nil, timeMinutes: 35, calories: 380, difficulty: "beginner")]),
      MealPlanWidgetDay(date: "2026-02-12", filledSlots: 0, meals: []),
      MealPlanWidgetDay(date: "2026-02-13", filledSlots: 2, meals: [MealPlanWidgetMeal(slot: "breakfast", title: "Berry Oats", recipeId: "demo-g", thumbnailUrl: nil, timeMinutes: 12, calories: 280, difficulty: "beginner"), MealPlanWidgetMeal(slot: "dinner", title: "Beef Stir Fry", recipeId: "demo-h", thumbnailUrl: nil, timeMinutes: 32, calories: 660, difficulty: "intermediate")]),
      MealPlanWidgetDay(date: "2026-02-14", filledSlots: 1, meals: [MealPlanWidgetMeal(slot: "lunch", title: "Tomato Basil Sandwich", recipeId: "demo-i", thumbnailUrl: nil, timeMinutes: 14, calories: 410, difficulty: "beginner")]),
      MealPlanWidgetDay(date: "2026-02-15", filledSlots: 0, meals: []),
    ]
  )
}

private let mealPlanDateFormatter: DateFormatter = {
  let formatter = DateFormatter()
  formatter.dateFormat = "yyyy-MM-dd"
  formatter.locale = Locale(identifier: "en_US_POSIX")
  return formatter
}()

private let mealPlanWeekdayFormatter: DateFormatter = {
  let formatter = DateFormatter()
  formatter.dateFormat = "EEE"
  formatter.locale = Locale(identifier: "en_US_POSIX")
  return formatter
}()

private func mealPlanSlotLabel(from slot: String) -> String {
  switch slot {
  case "breakfast": return "Breakfast"
  case "lunch": return "Lunch"
  case "dinner": return "Dinner"
  case "snack": return "Snack"
  default: return "Meal"
  }
}

private func mealPlanSlotSymbol(from slot: String) -> String {
  switch slot {
  case "breakfast": return "sun.max"
  case "lunch": return "fork.knife"
  case "dinner": return "moon.stars"
  case "snack": return "cup.and.saucer"
  default: return "circle"
  }
}

private func mealPlanFocusedSlot(for date: Date) -> String {
  let hour = Calendar.current.component(.hour, from: date)
  switch hour {
  case 5..<11:
    return "breakfast"
  case 11..<17:
    return "lunch"
  default:
    return "dinner"
  }
}

private func mealPlanNextFocusedSlotBoundary(after date: Date) -> Date {
  let calendar = Calendar.current
  let hour = calendar.component(.hour, from: date)
  let boundary: Date

  if hour < 5 {
    boundary = calendar.date(bySettingHour: 5, minute: 0, second: 0, of: date) ?? date.addingTimeInterval(3600)
  } else if hour < 11 {
    boundary = calendar.date(bySettingHour: 11, minute: 0, second: 0, of: date) ?? date.addingTimeInterval(3600)
  } else if hour < 17 {
    boundary = calendar.date(bySettingHour: 17, minute: 0, second: 0, of: date) ?? date.addingTimeInterval(3600)
  } else {
    let tomorrow = calendar.date(byAdding: .day, value: 1, to: date) ?? date.addingTimeInterval(86_400)
    boundary = calendar.date(bySettingHour: 5, minute: 0, second: 0, of: tomorrow) ?? tomorrow
  }

  return boundary > date ? boundary : date.addingTimeInterval(900)
}

private func mealPlanDifficultyLabel(_ raw: String?) -> String? {
  guard let raw, !raw.isEmpty else { return nil }
  switch raw.lowercased() {
  case "beginner": return "Easy"
  case "intermediate": return "Medium"
  case "advanced": return "Hard"
  default: return raw.prefix(1).uppercased() + raw.dropFirst()
  }
}

private func mealMetaLine(_ meal: MealPlanWidgetMeal) -> String {
  var chunks: [String] = []
  if let mins = meal.timeMinutes {
    chunks.append("\(mins)m")
  }
  if let level = mealPlanDifficultyLabel(meal.difficulty) {
    chunks.append(level)
  }
  if let cal = meal.calories {
    chunks.append("\(cal) cal")
  }
  return chunks.isEmpty ? "Tap to view recipe" : chunks.joined(separator: " · ")
}

private func mealPlanRecipeDeepLink(_ recipeID: String?) -> URL? {
  guard let recipeID, !recipeID.isEmpty else { return nil }
  var components = URLComponents()
  components.scheme = "recipeapp"
  components.host = "recipe"
  components.path = "/\(recipeID)"
  return components.url
}

private func mealPlanThumbnailURL(_ raw: String?) -> URL? {
  guard let raw, let url = URL(string: raw), let scheme = url.scheme?.lowercased() else {
    return nil
  }
  guard scheme == "https" || scheme == "http" else { return nil }
  return url
}

@ViewBuilder
private func mealPlanThumbnail(
  _ meal: MealPlanWidgetMeal?,
  size: CGFloat,
  cornerRadius: CGFloat,
  fallbackSlot: String? = nil
) -> some View {
  if let meal, let url = mealPlanThumbnailURL(meal.thumbnailUrl) {
    AsyncImage(url: url) { phase in
      switch phase {
      case .success(let image):
        image
          .resizable()
          .scaledToFill()
      default:
        mealPlanThumbnailFallback(slot: fallbackSlot ?? meal.slot, filled: true)
      }
    }
    .frame(width: size, height: size)
    .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        .stroke(.white.opacity(0.32), lineWidth: 0.8)
    )
  } else {
    mealPlanThumbnailFallback(slot: fallbackSlot ?? meal?.slot ?? "meal", filled: meal != nil)
      .frame(width: size, height: size)
      .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
      .overlay(
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
          .stroke(.white.opacity(0.32), lineWidth: 0.8)
      )
  }
}

private func mealPlanThumbnailFallback(slot: String, filled: Bool) -> some View {
  ZStack {
    LinearGradient(
      colors: filled
        ? [Color(hex: "#F8E7CE"), Color(hex: "#E4C894")]
        : [Color(hex: "#F2EEE7"), Color(hex: "#E8E2D8")],
      startPoint: .topLeading,
      endPoint: .bottomTrailing
    )
    Image(systemName: mealPlanSlotSymbol(from: slot))
      .font(.system(size: 11, weight: .semibold))
      .foregroundStyle(filled ? Color(hex: "#8C6230") : Color(hex: "#A79A86"))
  }
}

private let savedRecipesWidgetKind = "SavedRecipesWidget"
private let savedRecipesWidgetStorageKey = "savedRecipesWidgetV1"
private let savedRecipesFallbackDeepLink = URL(string: "recipeapp://")

private struct SavedRecipesWidgetItem: Codable, Hashable, Identifiable {
  let id: String
  let title: String
  let thumbnailUrl: String?
  let totalTimeMinutes: Int?
  let difficulty: String?
  let isFavorite: Bool
  let createdAt: String?
}

private struct SavedRecipesWidgetPayload: Codable {
  let version: Int
  let generatedAt: Double
  let recipes: [SavedRecipesWidgetItem]
}

private struct SavedRecipesWidgetEntry: TimelineEntry {
  let date: Date
  let payload: SavedRecipesWidgetPayload?
}

private struct SavedRecipesWidgetProvider: TimelineProvider {
  func placeholder(in _: Context) -> SavedRecipesWidgetEntry {
    SavedRecipesWidgetEntry(date: Date(), payload: samplePayload())
  }

  func getSnapshot(in _: Context, completion: @escaping (SavedRecipesWidgetEntry) -> Void) {
    completion(currentEntry())
  }

  func getTimeline(in _: Context, completion: @escaping (Timeline<SavedRecipesWidgetEntry>) -> Void) {
    let entry = currentEntry()
    let refresh = Calendar.current.date(byAdding: .minute, value: 20, to: Date()) ?? Date().addingTimeInterval(1200)
    completion(Timeline(entries: [entry], policy: .after(refresh)))
  }

  private func currentEntry() -> SavedRecipesWidgetEntry {
    SavedRecipesWidgetEntry(date: Date(), payload: readPayload())
  }

  private func readPayload() -> SavedRecipesWidgetPayload? {
    guard
      let defaults = UserDefaults(suiteName: mealPlanWidgetGroupIdentifier),
      let raw = defaults.string(forKey: savedRecipesWidgetStorageKey),
      let data = raw.data(using: .utf8)
    else {
      return nil
    }

    return try? JSONDecoder().decode(SavedRecipesWidgetPayload.self, from: data)
  }

  private func samplePayload() -> SavedRecipesWidgetPayload {
    SavedRecipesWidgetPayload(
      version: 1,
      generatedAt: Date().timeIntervalSince1970 * 1000,
      recipes: [
        SavedRecipesWidgetItem(id: "demo-1", title: "Creamy Garlic Pasta", thumbnailUrl: nil, totalTimeMinutes: 25, difficulty: "beginner", isFavorite: true, createdAt: nil),
        SavedRecipesWidgetItem(id: "demo-2", title: "Honey Lime Salmon Bowl", thumbnailUrl: nil, totalTimeMinutes: 30, difficulty: "intermediate", isFavorite: true, createdAt: nil),
        SavedRecipesWidgetItem(id: "demo-3", title: "Spicy Chicken Wrap", thumbnailUrl: nil, totalTimeMinutes: 18, difficulty: "beginner", isFavorite: false, createdAt: nil),
        SavedRecipesWidgetItem(id: "demo-4", title: "Mushroom Risotto", thumbnailUrl: nil, totalTimeMinutes: 40, difficulty: "advanced", isFavorite: false, createdAt: nil),
      ]
    )
  }
}

struct SavedRecipesWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: savedRecipesWidgetKind, provider: SavedRecipesWidgetProvider()) { entry in
      SavedRecipesWidgetView(entry: entry)
        .widgetURL(savedRecipesFallbackDeepLink)
    }
    .configurationDisplayName("Cook From Saved")
    .description("Smart suggestion from your saved recipes for today.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

private struct SavedRecipesWidgetView: View {
  @Environment(\.widgetFamily) private var family

  let entry: SavedRecipesWidgetEntry

  private var recipes: [SavedRecipesWidgetItem] {
    entry.payload?.recipes ?? []
  }

  private var featuredRecipeIndex: Int {
    guard !recipes.isEmpty else { return 0 }
    let dayOfYear = Calendar.current.ordinality(of: .day, in: .year, for: Date()) ?? 1
    return (dayOfYear - 1) % recipes.count
  }

  private var featuredRecipe: SavedRecipesWidgetItem? {
    guard !recipes.isEmpty else { return nil }
    return recipes[featuredRecipeIndex]
  }

  private var secondaryRecipes: [SavedRecipesWidgetItem] {
    guard !recipes.isEmpty else { return [] }
    var rotated = recipes
    rotated.remove(at: featuredRecipeIndex)
    return rotated
  }

  private var suggestionLabel: String {
    let hour = Calendar.current.component(.hour, from: Date())
    switch hour {
    case 5..<11:
      return "Breakfast idea"
    case 11..<17:
      return "Lunch idea"
    case 17..<23:
      return "Dinner idea"
    default:
      return "Cook idea"
    }
  }

  var body: some View {
    Group {
      switch family {
      case .systemSmall:
        smallView
      case .systemLarge:
        largeView
      default:
        mediumView
      }
    }
    .mealPlanWidgetBackground {
      Color(hex: "#F7F4EE")
    }
    .widgetURL(featuredRecipe.flatMap { recipeDeepLink(for: $0.id) } ?? savedRecipesFallbackDeepLink)
  }

  private var smallView: some View {
    VStack(alignment: .leading, spacing: 8) {
      header

      if let recipe = featuredRecipe {
        featuredSimpleRow(recipe)
      } else {
        emptyState
      }
    }
    .padding(12)
  }

  private var mediumView: some View {
    VStack(alignment: .leading, spacing: 8) {
      header

      if let recipe = featuredRecipe {
        featuredSimpleRow(recipe)
      } else {
        emptyCard
      }

      if secondaryRecipes.isEmpty {
        Text("Save recipes to see suggestions.")
          .font(.system(size: 11, weight: .medium))
          .foregroundStyle(Color(hex: "#8A7255"))
          .lineLimit(2)
      } else {
        ForEach(Array(secondaryRecipes.prefix(1))) { recipe in
          savedRecipeRow(recipe)
        }
      }
    }
    .padding(12)
  }

  private var largeView: some View {
    VStack(alignment: .leading, spacing: 8) {
      header

      if let recipe = featuredRecipe {
        featuredSimpleRow(recipe)
      } else {
        emptyCard
      }

      if secondaryRecipes.isEmpty {
        Text("Save recipes to see suggestions.")
          .font(.system(size: 11, weight: .medium))
          .foregroundStyle(Color(hex: "#8A7255"))
          .lineLimit(2)
      } else {
        ForEach(Array(secondaryRecipes.prefix(3))) { recipe in
          savedRecipeRow(recipe)
        }
      }
      Spacer(minLength: 0)
    }
    .padding(12)
  }

  private var header: some View {
    HStack {
      Text("Cook From Saved")
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(Color(hex: "#2E2417"))

      Spacer()

      Text("\(recipes.count)")
        .font(.system(size: 11, weight: .bold, design: .rounded))
        .foregroundStyle(Color(hex: "#73562E"))
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
          Capsule()
            .fill(.white.opacity(0.72))
        )
    }
  }

  @ViewBuilder
  private func featuredSimpleRow(_ recipe: SavedRecipesWidgetItem) -> some View {
    let row = HStack(spacing: 10) {
      recipeThumbnail(recipe, size: 54, cornerRadius: 10)

      VStack(alignment: .leading, spacing: 2) {
        Text(suggestionLabel)
          .font(.system(size: 10, weight: .medium))
          .foregroundStyle(Color(hex: "#7E6750"))
        recipeHeadline(recipe, fontSize: 13)
        Text(recipeMetaText(recipe))
          .font(.system(size: 10, weight: .medium))
          .foregroundStyle(Color(hex: "#7E6750"))
          .lineLimit(1)
      }

      Spacer(minLength: 0)
    }
    .padding(.horizontal, 9)
    .padding(.vertical, 8)
    .background(
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(.white.opacity(0.75))
    )

    if let url = recipeDeepLink(for: recipe.id) {
      Link(destination: url) {
        row
      }
    } else {
      row
    }
  }

  @ViewBuilder
  private func savedRecipeRow(_ recipe: SavedRecipesWidgetItem) -> some View {
    let row = HStack(spacing: 7) {
      recipeThumbnail(recipe, size: 26, cornerRadius: 7)

      VStack(alignment: .leading, spacing: 1) {
        Text(recipe.title)
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(Color(hex: "#322518"))
          .lineLimit(1)
        Text(recipeMetaText(recipe))
          .font(.system(size: 9, weight: .medium))
          .foregroundStyle(Color(hex: "#7E6750"))
          .lineLimit(1)
      }

      Spacer(minLength: 0)

      if recipe.isFavorite {
        Image(systemName: "heart.fill")
          .font(.system(size: 9, weight: .semibold))
          .foregroundStyle(Color(hex: "#A05C45"))
      }
    }
    .padding(.horizontal, 7)
    .padding(.vertical, 5)
    .background(
      RoundedRectangle(cornerRadius: 9, style: .continuous)
        .fill(.white.opacity(0.72))
    )

    if let url = recipeDeepLink(for: recipe.id) {
      Link(destination: url) {
        row
      }
    } else {
      row
    }
  }

  @ViewBuilder
  private func recipeHeadline(_ recipe: SavedRecipesWidgetItem, fontSize: CGFloat) -> some View {
    Text(recipe.title)
      .font(.system(size: fontSize, weight: .semibold))
      .foregroundStyle(Color(hex: "#2E2417"))
      .lineLimit(2)
  }

  private func recipeMetaText(_ recipe: SavedRecipesWidgetItem) -> String {
    var chunks: [String] = []
    if let minutes = recipe.totalTimeMinutes {
      chunks.append("\(minutes)m")
    }
    if let difficulty = difficultyLabel(recipe.difficulty) {
      chunks.append(difficulty)
    }
    return chunks.isEmpty ? "Open recipe" : chunks.joined(separator: " · ")
  }

  private var emptyCard: some View {
    VStack(alignment: .leading, spacing: 6) {
      Image(systemName: "bookmark")
        .font(.system(size: 16, weight: .semibold))
        .foregroundStyle(Color(hex: "#A06A31"))
      Text("No saved recipes yet")
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(Color(hex: "#6A5230"))
      Text("Save recipes in the app to get smart cook suggestions.")
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(Color(hex: "#8A7255"))
        .lineLimit(3)
    }
    .padding(10)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(
      RoundedRectangle(cornerRadius: 14, style: .continuous)
        .fill(.white.opacity(0.76))
    )
  }

  private var emptyState: some View {
    emptyCard
  }

  private func difficultyLabel(_ raw: String?) -> String? {
    guard let value = raw?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !value.isEmpty else {
      return nil
    }

    switch value {
    case "beginner":
      return "Easy"
    case "intermediate":
      return "Medium"
    case "advanced":
      return "Hard"
    default:
      return value.prefix(1).uppercased() + value.dropFirst()
    }
  }

  @ViewBuilder
  private func recipeThumbnail(_ recipe: SavedRecipesWidgetItem, size: CGFloat, cornerRadius: CGFloat) -> some View {
    if let url = recipeThumbnailURL(from: recipe.thumbnailUrl) {
      AsyncImage(url: url) { phase in
        switch phase {
        case .success(let image):
          image
            .resizable()
            .scaledToFill()
        default:
          thumbnailFallback(recipe: recipe)
        }
      }
      .frame(width: size, height: size)
      .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
      .overlay(
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
          .stroke(.white.opacity(0.35), lineWidth: 0.9)
      )
    } else {
      thumbnailFallback(recipe: recipe)
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .overlay(
          RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .stroke(.white.opacity(0.35), lineWidth: 0.9)
        )
    }
  }

  private func thumbnailFallback(recipe: SavedRecipesWidgetItem) -> some View {
    ZStack {
      LinearGradient(
        colors: [
          Color(hex: "#F7E5CD"),
          Color(hex: "#E4C79A"),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )

      Image(systemName: recipe.isFavorite ? "heart.fill" : "fork.knife")
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(Color(hex: "#8C6230"))
    }
  }

  private func recipeThumbnailURL(from raw: String?) -> URL? {
    guard let raw, let url = URL(string: raw), let scheme = url.scheme?.lowercased() else {
      return nil
    }
    guard scheme == "https" || scheme == "http" else {
      return nil
    }
    return url
  }

  private func recipeDeepLink(for recipeID: String) -> URL? {
    guard !recipeID.isEmpty else { return nil }
    var components = URLComponents()
    components.scheme = "recipeapp"
    components.host = "recipe"
    components.path = "/\(recipeID)"
    return components.url
  }
}

private extension View {
  @ViewBuilder
  func mealPlanWidgetBackground<Background: View>(
    @ViewBuilder _ background: () -> Background
  ) -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(for: .widget) {
        background()
      }
    } else {
      self.background(background())
    }
  }
}
