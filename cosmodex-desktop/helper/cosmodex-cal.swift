// cosmodex-cal — a tiny EventKit bridge for Cosmodex.
//
// One-way mirror: Cosmodex (the source of truth) pushes its dashboard-calendar
// items into a dedicated "Cosmodex" calendar in Apple Calendar so they can be
// viewed on iPhone / Mac / Watch. The user never edits on the Apple side, and
// because we only ever touch our OWN dedicated calendar, deleting is always safe.
//
// Commands (results printed as one JSON line on stdout):
//   access                 request Calendar permission -> {"granted":bool}
//   ensure-calendar        create/find the "Cosmodex" calendar -> {"calendar":id}
//   upsert   (stdin JSON)  create/update one event -> {"ekId":id}
//   delete <ekId>          remove one event -> {"deleted":bool}
//   list                   every event we manage -> {"events":[{ekId,cid}]}
//
// upsert stdin JSON: {"id","title","start","end","allDay","notes","ekId"?}
//   start/end are epoch seconds. id is the Cosmodex record id (stored on the
//   event's url as cosmodex://<id> so we can reconcile). ekId, if present and
//   still resolvable, updates that event in place; otherwise a new one is made.

import EventKit
import Foundation

let store = EKEventStore()
let CAL_TITLE = "Cosmodex"
let URL_SCHEME = "cosmodex"

func out(_ obj: [String: Any]) {
    let data = try! JSONSerialization.data(withJSONObject: obj, options: [])
    print(String(data: data, encoding: .utf8)!)
}
func fail(_ msg: String) -> Never { out(["error": msg]); exit(1) }

// Synchronously request full calendar access (macOS 14+).
func requestAccess() -> Bool {
    let sem = DispatchSemaphore(value: 0)
    var granted = false
    store.requestFullAccessToEvents { ok, _ in granted = ok; sem.signal() }
    sem.wait()
    return granted
}

// Prefer iCloud so the calendar syncs to the phone; fall back to a local store.
func pickSource() -> EKSource? {
    if let icloud = store.sources.first(where: { $0.sourceType == .calDAV && $0.title == "iCloud" }) { return icloud }
    if let local = store.sources.first(where: { $0.sourceType == .local }) { return local }
    return store.defaultCalendarForNewEvents?.source ?? store.sources.first
}

func cosmodexCalendar(createIfMissing: Bool) -> EKCalendar? {
    if let existing = store.calendars(for: .event).first(where: { $0.title == CAL_TITLE }) { return existing }
    guard createIfMissing else { return nil }
    let cal = EKCalendar(for: .event, eventStore: store)
    cal.title = CAL_TITLE
    cal.cgColor = CGColor(red: 0.21, green: 0.98, blue: 0.18, alpha: 1.0) // Cosmodex green
    guard let src = pickSource() else { return nil }
    cal.source = src
    do { try store.saveCalendar(cal, commit: true) } catch { return nil }
    return cal
}

// cosmodex id <-> event.url ("cosmodex://<id>")
func cidOf(_ ev: EKEvent) -> String? {
    guard let u = ev.url, u.scheme == URL_SCHEME else { return nil }
    return u.host ?? String(u.absoluteString.dropFirst("\(URL_SCHEME)://".count))
}

// All events we manage in the Cosmodex calendar, keyed by their cosmodex id.
func existingByCid(_ cal: EKCalendar) -> [String: EKEvent] {
    let c = Calendar.current
    let from = c.date(byAdding: .year, value: -1, to: Date())!
    let to = c.date(byAdding: .year, value: 2, to: Date())!
    let pred = store.predicateForEvents(withStart: from, end: to, calendars: [cal])
    var map: [String: EKEvent] = [:]
    for ev in store.events(matching: pred) { if let cid = cidOf(ev) { map[cid] = ev } }
    return map
}

// ── Reminders (EKReminder) — parallel one-way mirror of Cosmodex tasks ────────
// Same idea as the calendar mirror but into a dedicated "Cosmodex" Reminders
// list. EventKit has no public API for real Reminders subtasks, so a task's
// subtasks are written into the reminder's notes as a ☐/☑ checklist.

func requestReminderAccess() -> Bool {
    let sem = DispatchSemaphore(value: 0)
    var granted = false
    store.requestFullAccessToReminders { ok, _ in granted = ok; sem.signal() }
    sem.wait()
    return granted
}

// Reminders can only live in a source that supports them (iCloud/local).
func pickReminderSource() -> EKSource? {
    if let s = store.defaultCalendarForNewReminders()?.source { return s }
    if let icloud = store.sources.first(where: { $0.sourceType == .calDAV && $0.title == "iCloud" }) { return icloud }
    if let local = store.sources.first(where: { $0.sourceType == .local }) { return local }
    return store.sources.first
}

func cosmodexReminderList(createIfMissing: Bool) -> EKCalendar? {
    if let existing = store.calendars(for: .reminder).first(where: { $0.title == CAL_TITLE }) { return existing }
    guard createIfMissing else { return nil }
    let cal = EKCalendar(for: .reminder, eventStore: store)
    cal.title = CAL_TITLE
    guard let src = pickReminderSource() else { return nil }
    cal.source = src
    do { try store.saveCalendar(cal, commit: true) } catch { return nil }
    return cal
}

func cidOfReminder(_ r: EKReminder) -> String? {
    guard let u = r.url, u.scheme == URL_SCHEME else { return nil }
    return u.host ?? String(u.absoluteString.dropFirst("\(URL_SCHEME)://".count))
}

// fetchReminders is async — bridge it to a blocking call.
func existingRemindersByCid(_ cal: EKCalendar) -> [String: EKReminder] {
    let pred = store.predicateForReminders(in: [cal])
    let sem = DispatchSemaphore(value: 0)
    var result: [EKReminder] = []
    store.fetchReminders(matching: pred) { rems in result = rems ?? []; sem.signal() }
    sem.wait()
    var map: [String: EKReminder] = [:]
    for r in result { if let cid = cidOfReminder(r) { map[cid] = r } }
    return map
}

let args = CommandLine.arguments
guard args.count >= 2 else { fail("usage: cosmodex-cal <access|ensure-calendar|upsert|delete|list|sync|remind-access|remind-sync>") }
let cmd = args[1]

switch cmd {

case "access":
    out(["granted": requestAccess()])

case "ensure-calendar":
    guard requestAccess() else { fail("calendar access denied") }
    guard let cal = cosmodexCalendar(createIfMissing: true) else { fail("could not create calendar") }
    out(["calendar": cal.calendarIdentifier])

case "upsert":
    guard requestAccess() else { fail("calendar access denied") }
    guard let cal = cosmodexCalendar(createIfMissing: true) else { fail("could not create calendar") }
    let raw = FileHandle.standardInput.readDataToEndOfFile()
    guard let j = try? JSONSerialization.jsonObject(with: raw) as? [String: Any] else { fail("bad json on stdin") }
    guard let id = j["id"] as? String,
          let title = j["title"] as? String,
          let start = (j["start"] as? Double) ?? (j["start"] as? NSNumber)?.doubleValue,
          let end = (j["end"] as? Double) ?? (j["end"] as? NSNumber)?.doubleValue
    else { fail("missing id/title/start/end") }

    var ev: EKEvent?
    if let ekId = j["ekId"] as? String, !ekId.isEmpty { ev = store.event(withIdentifier: ekId) }
    let event = ev ?? EKEvent(eventStore: store)
    event.calendar = cal
    event.title = title
    event.startDate = Date(timeIntervalSince1970: start)
    event.endDate = Date(timeIntervalSince1970: end)
    event.isAllDay = (j["allDay"] as? Bool) ?? false
    event.notes = j["notes"] as? String
    event.url = URL(string: "\(URL_SCHEME)://\(id)")
    do { try store.save(event, span: .thisEvent, commit: true) } catch { fail("save failed: \(error.localizedDescription)") }
    out(["ekId": event.eventIdentifier ?? ""])

case "delete":
    guard args.count >= 3 else { fail("usage: cosmodex-cal delete <ekId>") }
    guard requestAccess() else { fail("calendar access denied") }
    let ekId = args[2]
    guard let event = store.event(withIdentifier: ekId) else { out(["deleted": false]); break }
    // Safety: only ever remove events in our own calendar.
    guard event.calendar?.title == CAL_TITLE else { fail("refusing to delete event outside the Cosmodex calendar") }
    do { try store.remove(event, span: .thisEvent, commit: true) } catch { fail("delete failed: \(error.localizedDescription)") }
    out(["deleted": true])

case "list":
    guard requestAccess() else { fail("calendar access denied") }
    guard let cal = cosmodexCalendar(createIfMissing: false) else { out(["events": []]); break }
    let events = existingByCid(cal).map { (cid, ev) in
        ["ekId": ev.eventIdentifier ?? "", "cid": cid]
    }
    out(["events": events])

case "sync":
    // Batch reconcile: stdin {"items":[{id,title,start,end,allDay,notes}...]}.
    // Upsert every desired item (matched by the cosmodex://id on its url) and
    // delete any event in the Cosmodex calendar whose id is no longer desired.
    guard requestAccess() else { fail("calendar access denied") }
    guard let cal = cosmodexCalendar(createIfMissing: true) else { fail("could not create calendar") }
    let raw = FileHandle.standardInput.readDataToEndOfFile()
    guard let j = try? JSONSerialization.jsonObject(with: raw) as? [String: Any],
          let items = j["items"] as? [[String: Any]] else { fail("bad json on stdin") }

    let existing = existingByCid(cal)
    var upserted = 0, deleted = 0
    var desiredCids = Set<String>()

    for it in items {
        guard let id = it["id"] as? String,
              let title = it["title"] as? String,
              let start = (it["start"] as? Double) ?? (it["start"] as? NSNumber)?.doubleValue,
              let end = (it["end"] as? Double) ?? (it["end"] as? NSNumber)?.doubleValue
        else { continue }
        desiredCids.insert(id)
        let event = existing[id] ?? EKEvent(eventStore: store)
        event.calendar = cal
        event.title = title
        event.startDate = Date(timeIntervalSince1970: start)
        event.endDate = Date(timeIntervalSince1970: end)
        event.isAllDay = (it["allDay"] as? Bool) ?? false
        event.notes = it["notes"] as? String
        event.url = URL(string: "\(URL_SCHEME)://\(id)")
        do { try store.save(event, span: .thisEvent, commit: false); upserted += 1 } catch {}
    }
    for (cid, ev) in existing where !desiredCids.contains(cid) {
        do { try store.remove(ev, span: .thisEvent, commit: false); deleted += 1 } catch {}
    }
    do { try store.commit() } catch { fail("commit failed: \(error.localizedDescription)") }
    out(["upserted": upserted, "deleted": deleted])

case "remind-access":
    out(["granted": requestReminderAccess()])

case "remind-sync":
    // Batch reconcile Cosmodex tasks into the "Cosmodex" Reminders list.
    // stdin {"items":[{id,title,due?,notes?,completed?}...]}; due is epoch seconds.
    guard requestReminderAccess() else { fail("reminders access denied") }
    guard let cal = cosmodexReminderList(createIfMissing: true) else { fail("could not create reminders list") }
    let raw = FileHandle.standardInput.readDataToEndOfFile()
    guard let j = try? JSONSerialization.jsonObject(with: raw) as? [String: Any],
          let items = j["items"] as? [[String: Any]] else { fail("bad json on stdin") }

    let existing = existingRemindersByCid(cal)
    var upserted = 0, deleted = 0
    var desiredCids = Set<String>()

    for it in items {
        guard let id = it["id"] as? String, let title = it["title"] as? String else { continue }
        desiredCids.insert(id)
        let rem = existing[id] ?? EKReminder(eventStore: store)
        rem.calendar = cal
        rem.title = title
        rem.notes = it["notes"] as? String
        rem.isCompleted = (it["completed"] as? Bool) ?? false
        rem.url = URL(string: "\(URL_SCHEME)://\(id)")
        if let due = (it["due"] as? Double) ?? (it["due"] as? NSNumber)?.doubleValue {
            let d = Date(timeIntervalSince1970: due)
            rem.dueDateComponents = Calendar.current.dateComponents([.year, .month, .day], from: d)
        } else {
            rem.dueDateComponents = nil
        }
        do { try store.save(rem, commit: false); upserted += 1 } catch {}
    }
    for (cid, r) in existing where !desiredCids.contains(cid) {
        guard r.calendar?.title == CAL_TITLE else { continue }  // only our own list
        do { try store.remove(r, commit: false); deleted += 1 } catch {}
    }
    do { try store.commit() } catch { fail("commit failed: \(error.localizedDescription)") }
    out(["upserted": upserted, "deleted": deleted])

default:
    fail("unknown command: \(cmd)")
}
