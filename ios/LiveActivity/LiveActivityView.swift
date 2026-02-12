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

  private struct LiveActivityIconView: View {
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

  // MARK: - Lock Screen / Notification Center
  struct LiveActivityView: View {
    let contentState: LiveActivityAttributes.ContentState
    let attributes: LiveActivityAttributes

    private var presentation: LiveActivityPresentation {
      LiveActivityPresentation(subtitle: contentState.subtitle)
    }

    private var accentColor: Color {
      attributes.progressViewTint.map { Color(hex: $0) } ?? Color(hex: "#D4AF37")
    }

    private var recipeDisplayName: String {
      presentation.recipeName.isEmpty ? attributes.name : presentation.recipeName
    }

    private var progressValue: Double {
      if let progress = contentState.progress {
        return min(max(progress, 0), 1)
      }
      return presentation.progress
    }

    private var timerDate: Double {
      contentState.timerEndDateInMilliseconds ?? 0
    }

    private var isDone: Bool {
      contentState.isTimerDone == true
        || (timerDate > 0 && (timerDate / 1000) <= (Date().timeIntervalSince1970 + 1.2))
    }

    private var contentPadding: EdgeInsets {
      let d = 16.0
      let top = Double(
        attributes.paddingDetails?.top ?? attributes.paddingDetails?.vertical ?? attributes.padding ?? Int(d))
      let bottom = Double(
        attributes.paddingDetails?.bottom ?? attributes.paddingDetails?.vertical ?? attributes.padding ?? Int(d))
      let leading = Double(
        attributes.paddingDetails?.left ?? attributes.paddingDetails?.horizontal ?? attributes.padding ?? Int(d))
      let trailing = Double(
        attributes.paddingDetails?.right ?? attributes.paddingDetails?.horizontal ?? attributes.padding ?? Int(d))
      return EdgeInsets(top: top, leading: leading, bottom: bottom, trailing: trailing)
    }

    var body: some View {
      VStack(alignment: .leading, spacing: 10) {
        // ── Header: recipe name + step badge ──
        HStack(alignment: .center) {
          Text(recipeDisplayName)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(.white)
            .lineLimit(1)

          Spacer(minLength: 8)

          Text("\(presentation.step)/\(presentation.total)")
            .font(.system(size: 13, weight: .heavy, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(.white.opacity(0.5))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(
              Capsule().fill(.white.opacity(0.1))
            )
        }

        // ── Instruction ──
        Text(contentState.title)
          .font(.system(size: 14, weight: .medium))
          .foregroundStyle(.white.opacity(0.8))
          .lineLimit(2)
          .frame(maxWidth: .infinity, alignment: .leading)

        // ── Progress bar ──
        GeometryReader { geo in
          ZStack(alignment: .leading) {
            Capsule()
              .fill(.white.opacity(0.1))
              .frame(height: 5)
            Capsule()
              .fill(isDone ? .green : accentColor)
              .frame(width: max(5, geo.size.width * progressValue), height: 5)
          }
        }
        .frame(height: 5)

        // ── Timer (only when active) ──
        if timerDate > 0 {
          HStack {
            Spacer()
            if isDone {
              HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                  .font(.system(size: 16, weight: .bold))
                  .foregroundStyle(.green)
                Text("Timer done")
                  .font(.system(size: 14, weight: .semibold))
                  .foregroundStyle(.green)
              }
            } else {
              HStack(spacing: 6) {
                Image(systemName: "timer")
                  .font(.system(size: 13, weight: .semibold))
                  .foregroundStyle(accentColor)
                Text(
                  timerInterval: Date.now...Date(timeIntervalSince1970: timerDate / 1000),
                  countsDown: true
                )
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(accentColor)
              }
            }
          }
          .padding(.top, 2)
        }
      }
      .padding(contentPadding)
    }
  }

#endif
