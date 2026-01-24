import SwiftUI

// MARK: - Layout Constants
enum FloatingNavLayout {
    static let barHeight: CGFloat = 56
    static let barCornerRadius: CGFloat = 28
    static let horizontalMargin: CGFloat = 16
    static let baseBottomPadding: CGFloat = 8
}

// MARK: - Tab Item Model
struct TabItem: Identifiable, Equatable {
    let id: String
    let label: String
    let icon: String
    let iconActive: String
}

// MARK: - Animated Tab Button
struct AnimatedTabButton: View {
    let item: TabItem
    let isSelected: Bool
    let primaryColor: Color
    let onTap: () -> Void

    @State private var isPressed = false

    private var iconName: String {
        isSelected ? item.iconActive : item.icon
    }

    private var foregroundColor: Color {
        isSelected ? primaryColor : Color(.systemGray)
    }

    var body: some View {
        Button(action: {
            let impactFeedback = UIImpactFeedbackGenerator(style: .light)
            impactFeedback.impactOccurred()
            onTap()
        }) {
            VStack(spacing: 4) {
                Image(systemName: iconName)
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(foregroundColor)

                Text(item.label)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(foregroundColor)
            }
            .frame(minWidth: 60)
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .opacity(isSelected ? 1.0 : 0.6)
        }
        .buttonStyle(TabButtonStyle())
    }
}

// MARK: - Tab Button Style with Spring Animation
struct TabButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.9 : 1.0)
            .animation(
                .spring(response: 0.25, dampingFraction: 0.6, blendDuration: 0),
                value: configuration.isPressed
            )
    }
}

// MARK: - iOS Glass Material Background
struct GlassBackground: View {
    var body: some View {
        ZStack {
            // Base blur material
            RoundedRectangle(cornerRadius: FloatingNavLayout.barCornerRadius)
                .fill(.ultraThinMaterial)

            // Glass overlay for extra shine
            RoundedRectangle(cornerRadius: FloatingNavLayout.barCornerRadius)
                .fill(
                    LinearGradient(
                        colors: [
                            .white.opacity(0.3),
                            .white.opacity(0.1)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )

            // Subtle inner border
            RoundedRectangle(cornerRadius: FloatingNavLayout.barCornerRadius)
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            .white.opacity(0.5),
                            .white.opacity(0.1)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: 0.5
                )
        }
    }
}

// MARK: - Main Floating Bottom Navigation Bar
struct FloatingBottomNav: View {
    @Binding var selectedTab: String

    var primaryColor: Color = Color(red: 0.9, green: 0.28, blue: 0.11) // #E6482E
    var items: [TabItem] = [
        TabItem(id: "recipes", label: "Recipes", icon: "book", iconActive: "book.fill"),
        TabItem(id: "ai-chef", label: "AI Chef", icon: "sparkles", iconActive: "sparkles"),
        TabItem(id: "shopping", label: "Shopping", icon: "cart", iconActive: "cart.fill"),
        TabItem(id: "profile", label: "Profile", icon: "person", iconActive: "person.fill")
    ]

    var body: some View {
        GeometryReader { geometry in
            let barWidth = min(geometry.size.width - (FloatingNavLayout.horizontalMargin * 2), 380)
            let safeAreaBottom = geometry.safeAreaInsets.bottom
            let bottomPadding = max(safeAreaBottom - 4, FloatingNavLayout.baseBottomPadding)

            // Pill-shaped bar with glass effect
            HStack(spacing: 0) {
                ForEach(items) { item in
                    AnimatedTabButton(
                        item: item,
                        isSelected: selectedTab == item.id,
                        primaryColor: primaryColor,
                        onTap: { selectedTab = item.id }
                    )
                }
            }
            .frame(width: barWidth, height: FloatingNavLayout.barHeight)
            .background(GlassBackground())
            // Soft shadow for depth
            .shadow(color: .black.opacity(0.05), radius: 10, x: 0, y: 1)
            .position(
                x: geometry.size.width / 2,
                y: geometry.size.height - FloatingNavLayout.barHeight / 2 - bottomPadding
            )
        }
        .edgesIgnoringSafeArea(.bottom)
    }
}

// MARK: - Content Padding Helper
extension View {
    /// Add bottom padding to account for the floating navigation bar
    func floatingNavPadding(_ safeAreaBottom: CGFloat) -> some View {
        let barBottomPadding = max(safeAreaBottom - 4, FloatingNavLayout.baseBottomPadding)
        let totalHeight = FloatingNavLayout.barHeight + barBottomPadding + 16
        return self.padding(.bottom, totalHeight)
    }
}

// MARK: - Preview
struct FloatingBottomNav_Previews: PreviewProvider {
    struct PreviewWrapper: View {
        @State private var selectedTab = "recipes"

        var body: some View {
            ZStack {
                // Sample content with gradient background
                LinearGradient(
                    colors: [Color(.systemBackground), Color(.systemGray6)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                VStack {
                    Text("Floating Nav Preview")
                        .font(.largeTitle.bold())
                    Text("Selected: \(selectedTab)")
                        .foregroundColor(.secondary)
                    Spacer()
                }
                .padding(.top, 60)

                // Navigation bar
                FloatingBottomNav(selectedTab: $selectedTab)
            }
        }
    }

    static var previews: some View {
        PreviewWrapper()
    }
}
