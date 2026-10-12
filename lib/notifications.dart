import 'dart:io';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:timezone/data/latest.dart' as data;
import 'package:timezone/timezone.dart' as tz;

class Reminders {
  static final plugin = FlutterLocalNotificationsPlugin();
  static bool initialized = false;
  static Future<void> init() async {
    if (initialized) return;
    data.initializeTimeZones();
    final zone = await FlutterTimezone.getLocalTimezone();
    tz.setLocalLocation(tz.getLocation(zone.identifier));
    await plugin.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
    );
    initialized = true;
  }

  static Future<bool> enable(
    int hour,
    int minute,
    String title,
    String body,
  ) async {
    if (!Platform.isAndroid && !Platform.isIOS) return false;
    await init();
    final granted = Platform.isAndroid
        ? await plugin
              .resolvePlatformSpecificImplementation<
                AndroidFlutterLocalNotificationsPlugin
              >()
              ?.requestNotificationsPermission()
        : await plugin
              .resolvePlatformSpecificImplementation<
                IOSFlutterLocalNotificationsPlugin
              >()
              ?.requestPermissions(alert: true, badge: false, sound: true);
    if (granted != true) return false;
    final now = tz.TZDateTime.now(tz.local);
    var when = tz.TZDateTime(
      tz.local,
      now.year,
      now.month,
      now.day,
      hour,
      minute,
    );
    if (!when.isAfter(now)) {
      when = tz.TZDateTime(
        tz.local,
        now.year,
        now.month,
        now.day + 1,
        hour,
        minute,
      );
    }
    await plugin.zonedSchedule(
      1,
      title,
      body,
      when,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'review',
          'Revisão bíblica',
          importance: Importance.defaultImportance,
          priority: Priority.defaultPriority,
        ),
        iOS: DarwinNotificationDetails(),
      ),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      matchDateTimeComponents: DateTimeComponents.time,
    );
    return true;
  }

  static Future<void> disable() async {
    await init();
    await plugin.cancel(1);
  }
}
