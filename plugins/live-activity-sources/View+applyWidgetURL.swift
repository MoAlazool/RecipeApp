import SwiftUI

private let cachedScheme: String? = {
  guard
    let urlTypes = Bundle.main.infoDictionary?["CFBundleURLTypes"] as? [[String: Any]],
    let schemes = urlTypes.first?["CFBundleURLSchemes"] as? [String],
    let firstScheme = schemes.first
  else {
    return nil
  }

  return firstScheme
}()

extension View {
  @ViewBuilder
  func applyWidgetURL(from urlString: String?) -> some View {
    applyIfPresent(urlString) { view, string in
      applyIfPresent(cachedScheme) { view, scheme in
        view.widgetURL(URL(string: scheme + "://" + string))
      }
    }
  }
}

func liveActivityActionPath(basePath: String?, action: String) -> String? {
  guard let basePath else { return nil }
  let trimmedPath = basePath.trimmingCharacters(in: .whitespacesAndNewlines)
  guard !trimmedPath.isEmpty else { return nil }

  let separator = trimmedPath.contains("?") ? "&" : "?"
  return "\(trimmedPath)\(separator)laAction=\(action)"
}

func liveActivityURL(from path: String?) -> URL? {
  guard let path else { return nil }
  let trimmedPath = path.trimmingCharacters(in: .whitespacesAndNewlines)
  guard !trimmedPath.isEmpty else { return nil }
  guard let scheme = cachedScheme else { return nil }
  return URL(string: "\(scheme)://\(trimmedPath)")
}
