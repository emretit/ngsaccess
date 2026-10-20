import Flutter
import UIKit
import XCTest

class RunnerTests: XCTestCase {
  func testPublishedApplicationHasCameraRecoveryConfiguration() {
    let application = Bundle.main
    XCTAssertEqual(application.bundleIdentifier, "com.ngsplus.app")
    let cameraReason = application.object(forInfoDictionaryKey: "NSCameraUsageDescription") as? String
    XCTAssertFalse(cameraReason?.isEmpty ?? true)
    XCTAssertNil(application.object(forInfoDictionaryKey: "NSPhotoLibraryUsageDescription"))
  }

  func testPrivacyManifestShipsInApplicationBundle() throws {
    let url = try XCTUnwrap(Bundle.main.url(forResource: "PrivacyInfo", withExtension: "xcprivacy"))
    let data = try Data(contentsOf: url)
    let manifest = try XCTUnwrap(
      PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any]
    )
    XCTAssertEqual(manifest["NSPrivacyTracking"] as? Bool, false)
  }
}
