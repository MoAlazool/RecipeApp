import SwiftUI
import WidgetKit

#if canImport(ActivityKit)

  struct ConditionalForegroundViewModifier: ViewModifier {
    let color: String?

    func body(content: Content) -> some View {
      if let color = color {
        content.foregroundStyle(Color(hex: color))
      } else {
        content
      }
    }
  }

  struct DebugLog: View {
    #if DEBUG
      private let message: String
      init(_ message: String) {
        self.message = message
        print(message)
      }

      var body: some View {
        Text(message)
          .font(.caption2)
          .foregroundStyle(.red)
      }
    #else
      init(_: String) {}
      var body: some View { EmptyView() }
    #endif
  }

  struct LiveActivityView: View {
    let contentState: LiveActivityAttributes.ContentState
    let attributes: LiveActivityAttributes
    @State private var imageContainerSize: CGSize?

    var body: some View {
      let primaryColor = attributes.progressViewTint.map { Color(hex: $0) } ?? Color(hex: "F2330D")
      let recipeTitle = contentState.subtitle ?? "Cooking"

      VStack(alignment: .leading, spacing: 14) {
        HStack(spacing: 10) {
          ZStack {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
              .fill(primaryColor.opacity(0.2))
            Image(systemName: "fork.knife")
              .font(.system(size: 14, weight: .semibold))
              .foregroundStyle(primaryColor)
          }
          .frame(width: 28, height: 28)

          Text(recipeTitle)
            .font(.system(size: 16, weight: .bold))
            .foregroundStyle(.white)
            .lineLimit(1)

          Spacer()

          ZStack {
            Circle()
              .fill(Color.white.opacity(0.12))
            Image(systemName: "xmark")
              .font(.system(size: 11, weight: .bold))
              .foregroundStyle(.white.opacity(0.75))
          }
          .frame(width: 28, height: 28)
        }

        VStack(alignment: .leading, spacing: 4) {
          Text("Cooking Step")
            .font(.caption2)
            .fontWeight(.bold)
            .foregroundStyle(Color.white.opacity(0.55))
            .textCase(.uppercase)
            .tracking(1.6)

          Text(contentState.title)
            .font(.system(size: 20, weight: .bold))
            .foregroundStyle(.white)
            .lineLimit(2)
            .minimumScaleFactor(0.85)
        }

        VStack(spacing: 6) {
          HStack {
            Text("Cooking Progress")
              .font(.system(size: 12, weight: .semibold))
              .foregroundStyle(Color.white.opacity(0.6))
            Spacer()
            if let date = contentState.timerEndDateInMilliseconds {
              Text(timerInterval: Date.toTimerInterval(miliseconds: date))
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(primaryColor)
                .monospacedDigit()
            }
          }

          if let date = contentState.timerEndDateInMilliseconds {
            ProgressView(timerInterval: Date.toTimerInterval(miliseconds: date))
              .progressViewStyle(.linear)
              .tint(primaryColor)
          } else if let progress = contentState.progress {
            ProgressView(value: progress)
              .progressViewStyle(.linear)
              .tint(primaryColor)
          }
        }

        if let date = contentState.timerEndDateInMilliseconds {
          CountdownBoxesView(endDate: Date(timeIntervalSince1970: date / 1000))
        }

        HStack(spacing: 10) {
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
      .padding(.horizontal, 18)
      .padding(.vertical, 16)
      .background(Color.black.opacity(0.85))
      .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
      .overlay(
        RoundedRectangle(cornerRadius: 22, style: .continuous)
          .stroke(Color.white.opacity(0.08), lineWidth: 1)
      )
    }
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
    .frame(maxWidth: .infinity, minHeight: 34)
    .background(background)
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
  }

  private struct CountdownBoxesView: View {
    let endDate: Date

    var body: some View {
      TimelineView(.periodic(from: .now, by: 1)) { context in
        let remainingSeconds = max(0, Int(endDate.timeIntervalSince(context.date)))
        let minutes = remainingSeconds / 60
        let seconds = remainingSeconds % 60

        HStack(spacing: 12) {
          timeBox(value: String(format: "%02d", minutes), label: "Minutes")
          Text(":")
            .font(.system(size: 18, weight: .bold))
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
            .font(.system(size: 22, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .monospacedDigit()
        }
        .frame(height: 56)

        Text(label)
          .font(.system(size: 10, weight: .bold))
          .foregroundStyle(Color.white.opacity(0.5))
          .textCase(.uppercase)
          .tracking(1.2)
      }
      .frame(maxWidth: .infinity)
    }
  }

#endif
