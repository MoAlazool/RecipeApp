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
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading, priority: 1) {
          DynamicIslandExpandedLeading(
            title: context.state.title,
            subtitle: context.state.subtitle
          )
          .padding(.leading, 6)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
        DynamicIslandExpandedRegion(.center) {
          DynamicIslandExpandedCenter(
            title: context.state.title,
            endDateInMilliseconds: context.state.timerEndDateInMilliseconds,
            progress: context.state.progress
          )
          .padding(.horizontal, 6)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
        DynamicIslandExpandedRegion(.bottom) {
          DynamicIslandExpandedBottom(
            endDateInMilliseconds: context.state.timerEndDateInMilliseconds
          )
          .padding(.horizontal, 6)
          .padding(.bottom, 2)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
      } compactLeading: {
        Image(systemName: "fork.knife")
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(Color(hex: "F2330D"))
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
      } compactTrailing: {
        if let date = context.state.timerEndDateInMilliseconds {
          compactTimer(
            endDate: date,
            timerType: context.attributes.timerType ?? .circular,
            progressViewTint: context.attributes.progressViewTint
          ).applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
      } minimal: {
        if let date = context.state.timerEndDateInMilliseconds {
          compactTimer(
            endDate: date,
            timerType: context.attributes.timerType ?? .circular,
            progressViewTint: context.attributes.progressViewTint
          ).applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
      }
    }
  }

  @ViewBuilder
  private func compactTimer(
    endDate: Double,
    timerType: LiveActivityAttributes.DynamicIslandTimerType,
    progressViewTint: String?
  ) -> some View {
    if timerType == .digital {
      Text(timerInterval: Date.toTimerInterval(miliseconds: endDate))
        .font(.system(size: 15))
        .minimumScaleFactor(0.8)
        .fontWeight(.semibold)
        .frame(maxWidth: 60)
        .multilineTextAlignment(.trailing)
    } else {
      circularTimer(endDate: endDate)
        .tint(progressViewTint.map { Color(hex: $0) })
    }
  }

  private func circularTimer(endDate: Double) -> some View {
    ProgressView(
      timerInterval: Date.toTimerInterval(miliseconds: endDate),
      countsDown: false,
      label: { EmptyView() },
      currentValueLabel: {
        EmptyView()
      }
    )
    .progressViewStyle(.circular)
  }
}

private struct DynamicIslandExpandedLeading: View {
  let title: String
  let subtitle: String?

  private let primaryColor = Color(hex: "F2330D")

  var body: some View {
    let recipeTitle = subtitle ?? title
    HStack(spacing: 8) {
      ZStack {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
          .fill(primaryColor.opacity(0.2))
        Image(systemName: "fork.knife")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(primaryColor)
      }
      .frame(width: 26, height: 26)

      Text(recipeTitle)
        .font(.system(size: 14, weight: .bold))
        .foregroundStyle(.white)
        .lineLimit(1)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

private struct DynamicIslandExpandedCenter: View {
  let title: String
  let endDateInMilliseconds: Double?
  let progress: Double?

  private let primaryColor = Color(hex: "F2330D")

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("Cooking Step")
        .font(.caption2)
        .fontWeight(.bold)
        .foregroundStyle(Color.white.opacity(0.55))
        .textCase(.uppercase)
        .tracking(1.5)

      Text(title)
        .font(.system(size: 18, weight: .bold))
        .foregroundStyle(.white)
        .lineLimit(2)
        .minimumScaleFactor(0.85)

      HStack {
        Text("Cooking Progress")
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(Color.white.opacity(0.6))
        Spacer()
        if let endDate = endDateInMilliseconds {
          Text(timerInterval: Date.toTimerInterval(miliseconds: endDate))
            .font(.system(size: 13, weight: .bold, design: .rounded))
            .foregroundStyle(primaryColor)
            .monospacedDigit()
        }
      }

      if let endDate = endDateInMilliseconds {
        ProgressView(timerInterval: Date.toTimerInterval(miliseconds: endDate))
          .progressViewStyle(.linear)
          .tint(primaryColor)
      } else if let progress {
        ProgressView(value: progress)
          .progressViewStyle(.linear)
          .tint(primaryColor)
      }
    }
    .padding(.vertical, 2)
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

private struct DynamicIslandExpandedBottom: View {
  let endDateInMilliseconds: Double?

  private let primaryColor = Color(hex: "F2330D")

  var body: some View {
    VStack(spacing: 10) {
      if let endDate = endDateInMilliseconds {
        CountdownBoxesView(endDate: Date(timeIntervalSince1970: endDate / 1000))
      }

      HStack(spacing: 8) {
        actionPill(
          title: "Pause",
          systemImage: "pause.fill",
          background: Color.white.opacity(0.12),
          foreground: .white
        )

        actionPill(
          title: "+1m",
          systemImage: nil,
          background: Color.white.opacity(0.12),
          foreground: .white
        )

        actionPill(
          title: "Finish",
          systemImage: "checkmark.circle.fill",
          background: primaryColor,
          foreground: .white
        )
      }
    }
    .padding(.horizontal, 8)
    .padding(.vertical, 6)
    .background(Color.black.opacity(0.85))
    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 22, style: .continuous)
        .stroke(Color.white.opacity(0.08), lineWidth: 1)
    )
  }

  private func actionPill(
    title: String,
    systemImage: String?,
    background: Color,
    foreground: Color
  ) -> some View {
    HStack(spacing: 6) {
      if let systemImage {
        Image(systemName: systemImage)
          .font(.system(size: 12, weight: .semibold))
      }
      Text(title)
        .font(.system(size: 12, weight: .bold))
    }
    .foregroundStyle(foreground)
    .frame(maxWidth: .infinity, minHeight: 30)
    .background(background)
    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
  }
}

private struct CountdownBoxesView: View {
  let endDate: Date

  var body: some View {
    TimelineView(.periodic(from: .now, by: 1)) { context in
      let remainingSeconds = max(0, Int(endDate.timeIntervalSince(context.date)))
      let minutes = remainingSeconds / 60
      let seconds = remainingSeconds % 60

      HStack(spacing: 10) {
        timeBox(value: String(format: "%02d", minutes), label: "Minutes")
        Text(":")
          .font(.system(size: 16, weight: .bold))
          .foregroundStyle(Color.white.opacity(0.5))
          .padding(.bottom, 10)
        timeBox(value: String(format: "%02d", seconds), label: "Seconds")
      }
    }
  }

  private func timeBox(value: String, label: String) -> some View {
    VStack(spacing: 4) {
      ZStack {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
          .fill(Color.white.opacity(0.08))
          .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
              .stroke(Color.white.opacity(0.06), lineWidth: 1)
          )
        Text(value)
          .font(.system(size: 20, weight: .bold, design: .rounded))
          .foregroundStyle(.white)
          .monospacedDigit()
      }
      .frame(height: 46)

      Text(label)
        .font(.system(size: 9, weight: .bold))
        .foregroundStyle(Color.white.opacity(0.5))
        .textCase(.uppercase)
        .tracking(1.2)
    }
    .frame(maxWidth: .infinity)
  }
}
