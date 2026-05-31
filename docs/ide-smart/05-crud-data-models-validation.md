# 5. CRUD Data Models & Validation

## 5.1 User Record

Users are identified by a 64-bit integer ID (typically a card number or QR code value). Each user can be valid within a time window and can hold up to `AC.MAX_PERMS_PER_USER` permission references (default **16** in v0.1.0; see §10 / `09-access-control-logic.md`).

{  
  "id":            1234567890123456,  // int, 1 – 9007199254740991  
  "start":         1710988800,         // Unix epoch (UTC), 0 = no restriction  
  "end":           1713577200,         // Unix epoch (UTC), 0 = no restriction  
  "current_zone":  1,                  // int 0–255, used for anti-passback  
  "status":        1,                  // int, 0 = disabled, 1 = enabled  
  "permissions":   [1, 2, 5]           // list of permission IDs, up to AC.MAX_PERMS_PER_USER slots (default 16 in v0.1.0)  
}

| Field | Type | Required | Validation |
| :---- | :---- | :---- | :---- |
| id | int (64-bit) | Yes | 1 – 9007199254740991 |
| start | int | No | Unix timestamp, 0 = no restriction |
| end | int | No | Unix timestamp, 0 = no restriction |
| current_zone | int | No | 0 – 255 |
| status | int | No | 0 (disabled) or 1 (enabled). Default 1\. |
| permissions | int[] | No | List of permission IDs. Max items = AC.MAX_PERMS_PER_USER (default is 16). Each ID 1–65535. |

## 5.2 Permission Record

Permissions define which actuators a user can activate and during which time windows. A user can reference up to `AC.MAX_PERMS_PER_USER` permissions (default **16** in v0.1.0).

{  
  "id":       1,           // int, 1–65535  
  "io":       [0],         // list of actuator IDs, max 8 items, values 0–7  
  "schedule": {  
    "start":     480,         // minute-of-day (0–1439). 480 = 08:00  
    "end":       1080,        // minute-of-day. 1080 = 18:00  
    "week_days": [0,1,2,3,4] // 0=Sunday … 6=Saturday  
    // "month_days": [1,15]   // for "monthly": day-of-month 1–31  
    // "year_days":  [1,100]  // for "yearly":  day-of-year 1–366  
  },  
  "max_uses":    0,        // v0.1.0+ usage cap per reset window. 0 = unlimited.  
  "period_type": 0         // v0.1.0+ 0=none, 1=daily, 2=weekly, 3=monthly, 4=yearly  
}

| Field | Type | Required | Validation |
| :---- | :---- | :---- | :---- |
| id | int | Yes | 1–65535 |
| io | int[] | Yes | List of actuator IDs 0–7, max 8 items |
| schedule.start | int | Yes | Minute of day 0–1439 |
| schedule.end | int | Yes | Minute of day 0–1439 |
| week_days | int[] | If weekly | Values 0 (Sunday) – 6 (Saturday) |
| month_days | int[] | If monthly | Values 1–31 |
| year_days | int[] | If yearly | Values 1–366 |
| max_uses | int | No | 0–65535. 0 = unlimited. v0.1.0+ Pair with period_type. |
| period_type | int | No | 0 = no limit (default), 1 = daily, 2 = weekly, 3 = monthly, 4 = yearly. v0.1.0+ Pair with max_uses. |

**ℹ  Note:** Exactly one of week_days, month_days, or year_days should be provided.

## 5.3 Scenario Record

Scenarios define automated reactions to device events. A scenario has a trigger, optional preconditions, and a list of actions to execute in order.

{  
  "id":     10,  
  "trigger": {  
    "type":   "time",         // "time" | "device_state"  
    "params": { "at": 480 }   // minute-of-day for "time" trigger  
  },  
  "preconditions": {          // optional  
    "relation": "all",        // "all" (AND) | "any" (OR)  
    "items": [  
      { "type": "time_window",  "params": { "from": 420, "to": 1080 } },  
      { "type": "device_state", "params": { "io": 0, "target_device": "1", "expected_state": 0 } }  
    ]  
  },  
  "actions": [  
    { "type": "device_control", "params": { "io": 0, "target_device": "1", "value": 1 } },  
    { "type": "delay",          "params": { "secs": 3 } },  
    { "type": "device_control", "params": { "io": 0, "target_device": "1", "value": 0 } }  
  ],  
  "error_policy": "continue"  // "continue" | "abort". Default: abort  
}

### Trigger Types

| Type | Required Params | Description |
| :---- | :---- | :---- |
| time | at (int 0–1439) | Fires at a specific minute of the day. |
| device_state | io (int 0–7), target_device (string), expected_state (0|1) | Fires when a device input/output reaches the expected state. |

### Precondition Types

| Type | Required Params | Description |
| :---- | :---- | :---- |
| time_window | from, to (int 0–1439 each) | Scenario is gated to run only within the time window. |
| device_state | io, target_device, expected_state | Scenario is gated by the current state of an IO point. |

### Action Types

| Type | Required Params | Description |
| :---- | :---- | :---- |
| device_control | io (0–7), target_device (string), value (0|1) | Sets an output to the given value. target_device = "1" = self. |
| delay | secs (int 0–3600) | Waits for the specified number of seconds before the next action. |

## 5.4 Log Record (Read & Delete Only)

The log data type is read-only via get_data and can be fully cleared via delete_all_data. Each log record is an access event produced by update_actuator.

For detailed information see [0.1.1 Release Notes](https://docs.google.com/document/d/1ikLCX4fAWTfjlZlfY60DLelCjEUPnqvs-u1eg6kwJu0/edit?tab=t.0)

**ℹ  Note:** The log get_data route supports page \+ page_len only (no single-record lookup by ID).
