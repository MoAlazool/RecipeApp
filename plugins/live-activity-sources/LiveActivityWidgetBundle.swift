import SwiftUI
import WidgetKit

@main
struct LiveActivityWidgetBundle: WidgetBundle {
  var body: some Widget {
    LiveActivityWidget()
    MealPlanTodayWidget()
    MealPlanWeekWidget()
    SavedRecipesWidget()
  }
}
