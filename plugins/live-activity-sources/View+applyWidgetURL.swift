import Foundation
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

private func normalizedLiveActivityPath(_ path: String?) -> String? {
  guard let path else { return nil }
  let trimmedPath = path.trimmingCharacters(in: .whitespacesAndNewlines)
  guard !trimmedPath.isEmpty else { return nil }
  return trimmedPath
}

func liveActivityActionPath(basePath: String?, action: String) -> String? {
  guard let trimmedPath = normalizedLiveActivityPath(basePath) else { return nil }

  let separator = trimmedPath.contains("?") ? "&" : "?"
  return "\(trimmedPath)\(separator)laAction=\(action)"
}

func liveActivityResumePath(basePath: String?, stepIndex: Int?) -> String? {
  guard let trimmedPath = normalizedLiveActivityPath(basePath) else { return nil }

  let parts = trimmedPath.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false)
  let pathComponent = String(parts[0])
  let existingQuery = parts.count > 1 ? String(parts[1]) : nil

  var queryItems: [URLQueryItem] = []
  if let existingQuery, !existingQuery.isEmpty {
    var existingQueryComponents = URLComponents()
    existingQueryComponents.percentEncodedQuery = existingQuery
    queryItems = existingQueryComponents.queryItems ?? []
  }

  queryItems.removeAll { $0.name == "laStep" || $0.name == "laSource" }

  if let stepIndex, stepIndex >= 0 {
    queryItems.append(URLQueryItem(name: "laStep", value: String(stepIndex)))
  }
  queryItems.append(URLQueryItem(name: "laSource", value: "liveActivity"))

  var encodedQuery = URLComponents()
  encodedQuery.queryItems = queryItems

  guard let percentEncodedQuery = encodedQuery.percentEncodedQuery, !percentEncodedQuery.isEmpty else {
    return pathComponent
  }

  return "\(pathComponent)?\(percentEncodedQuery)"
}

func liveActivityURL(from path: String?) -> URL? {
  guard let trimmedPath = normalizedLiveActivityPath(path) else { return nil }
  guard let scheme = cachedScheme else { return nil }
  return URL(string: "\(scheme)://\(trimmedPath)")
}
