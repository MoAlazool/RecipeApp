import ActivityKit
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

struct LiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LiveActivityAttributes.self) { context in
      LiveActivityView(contentState: context.state, attributes: context.attributes)
        .activityBackgroundTint(
          context.attributes.backgroundColor.map { Color(hex: $0) }
        )
        .activitySystemActionForegroundColor(Color.black)
        .applyWidgetURL(from: context.attributes.deepLinkUrl)
    } dynamicIsland: { context in
      // Parse "RecipeName||STEP X OF Y" from subtitle
      let parts = (context.state.subtitle ?? "").components(separatedBy: "||")
      let recipeName = parts.first ?? ""
      let stepInfo = parts.count > 1 ? parts[1] : ""
      // Extract step and total from "STEP X OF Y"
      let nums = stepInfo.components(separatedBy: CharacterSet.decimalDigits.inverted)
        .compactMap { Int($0) }
      let step = nums.count > 0 ? nums[0] : 1
      let total = nums.count > 1 ? nums[1] : 1

      return DynamicIsland {
        // ── EXPANDED: Leading ──
        DynamicIslandExpandedRegion(.leading, priority: 1) {
          VStack(alignment: .leading, spacing: 8) {
            // Cooking badge + recipe name
            HStack(spacing: 5) {
              Image(systemName: "frying.pan.fill")
                .font(.system(size: 11))
                .foregroundColor(Color(hex: "#F2330D"))
              Text(recipeName.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(.white.opacity(0.5))
                .kerning(1)
                .lineLimit(1)
            }

            // Step label
            Text("STEP \(step) OF \(total)")
              .font(.system(size: 14, weight: .bold, design: .rounded))
              .foregroundStyle(.white)
          }
          .padding(.leading, 4)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }

        // ── EXPANDED: Trailing ──
        DynamicIslandExpandedRegion(.trailing) {
          VStack(spacing: 1) {
            Text("\(step)")
              .font(.system(size: 28, weight: .heavy, design: .rounded))
              .foregroundColor(Color(hex: "#F2330D"))
            Text("OF \(total)")
              .font(.system(size: 9, weight: .heavy, design: .rounded))
              .foregroundStyle(.white.opacity(0.4))
              .kerning(1)
          }
          .padding(.trailing, 4)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }

        // ── EXPANDED: Bottom ──
        DynamicIslandExpandedRegion(.bottom) {
          VStack(spacing: 10) {
            // Step progress bar segments
            if total > 0 {
              HStack(spacing: 3) {
                ForEach(0..<total, id: \.self) { i in
                  Capsule()
                    .fill(i < step
                      ? Color(hex: "#F2330D")
                      : Color.white.opacity(0.15))
                    .frame(height: 4)
                }
              }
            }

            // Timer row (only when active)
            if let date = context.state.timerEndDateInMilliseconds {
              HStack {
                Image(systemName: "timer")
                  .font(.system(size: 13, weight: .semibold))
                  .foregroundColor(Color(hex: "#F2330D"))

                Spacer()

                Text(timerInterval: Date.toTimerInterval(miliseconds: date))
                  .font(.system(size: 15, weight: .bold, design: .rounded))
                  .foregroundStyle(.white)
                  .monospacedDigit()
              }
            }
          }
          .padding(.horizontal, 4)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }

      // ── COMPACT: Leading (pill left) ──
      } compactLeading: {
        if context.state.timerEndDateInMilliseconds != nil {
          // Timer active: show flame + step number
          HStack(spacing: 4) {
            Image(systemName: "frying.pan.fill")
              .font(.system(size: 12))
              .foregroundColor(Color(hex: "#F2330D"))
            Text("\(step)/\(total)")
              .font(.system(size: 12, weight: .bold, design: .rounded))
              .foregroundColor(Color(hex: "#F2330D"))
          }
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else {
          // No timer: just flame
          Image(systemName: "frying.pan.fill")
            .font(.system(size: 14, weight: .semibold))
            .foregroundColor(Color(hex: "#F2330D"))
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }

      // ── COMPACT: Trailing (pill right) ──
      } compactTrailing: {
        if let date = context.state.timerEndDateInMilliseconds {
          // Timer active: show countdown
          HStack(spacing: 4) {
            Image(systemName: "timer")
              .font(.system(size: 11))
              .foregroundColor(Color(hex: "#F2330D"))
            Text(timerInterval: Date.toTimerInterval(miliseconds: date))
              .font(.system(size: 14, weight: .bold, design: .rounded))
              .monospacedDigit()
              .foregroundColor(Color(hex: "#F2330D"))
          }
          .frame(maxWidth: 70)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else {
          // No timer: show step counter
          HStack(spacing: 3) {
            Text("\(step)")
              .font(.system(size: 15, weight: .heavy, design: .rounded))
              .foregroundColor(Color(hex: "#F2330D"))
            Text("/\(total)")
              .font(.system(size: 12, weight: .semibold, design: .rounded))
              .foregroundStyle(.white.opacity(0.5))
          }
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }

      // ── MINIMAL ──
      } minimal: {
        Image(systemName: "frying.pan.fill")
          .font(.system(size: 13))
          .foregroundColor(Color(hex: "#F2330D"))
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
      }
    }
  }
}
