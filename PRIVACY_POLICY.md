# FirePulse — Privacy Policy

**Effective Date:** March 7, 2026
**Last Updated:** March 7, 2026

---

## 1. Overview

FirePulse is a local-network firefighter training heart rate monitoring system.
This Privacy Policy describes what data is collected, how it is stored, and the
responsibilities of the organization operating the Software (the "Operator").

**FirePulse is designed as a local-only application.** All data remains on the
Operator's own infrastructure. The Software does not transmit data to the
Copyright Holder, to cloud services, or to any third party.

## 2. Data Collected

The following categories of data are collected and stored by FirePulse during
normal operation:

### 2.1 Participant Information

- First and last name
- Company or unit assignment
- Class and session enrollment records

### 2.2 Biometric and Vital Sign Data

- **Heart rate** — continuously collected from Bluetooth Low Energy (BLE)
  wearable sensors during training sessions
- **Rehab vital signs** — manually entered by medical personnel during rehab
  evaluations, which may include:
  - Heart rate (manual)
  - Blood pressure (systolic and diastolic)
  - Respiratory rate
  - Blood oxygen saturation (SpO2)
  - Body temperature and measurement method
- **Telemetry metadata** — signal strength (RSSI), battery level, and device
  identifiers

### 2.3 Operational Data

- Session records (name, timing, state changes, participant status)
- Device assignments (which sensor is assigned to which participant)
- Alert records (threshold violations, acknowledgments)
- Rehab visit records (timestamps, checkpoints, dispositions, clinical notes)
- Audit log entries (user actions within the system)

### 2.4 User Account Data

- Display name and username
- Role assignment (admin, instructor, medical)
- Hashed password (bcrypt; plaintext passwords are never stored)
- Authentication tokens (JWT; session-based, not persisted)

## 3. Data Storage

### 3.1 Local Storage Only

All data is stored locally on the Operator's infrastructure:

- **PostgreSQL database** — all participant, session, telemetry, and
  configuration data
- **Redis** — temporary real-time telemetry state and WebSocket session data
  (not persisted long-term)

**No data is transmitted to external servers, cloud services, or third parties.**

### 3.2 Data Retention

The Operator is responsible for establishing and enforcing data retention
policies appropriate to their organization and applicable regulations. The
Software stores data indefinitely unless the Operator takes action to delete it.

The Software includes a raw telemetry pruner that automatically removes
high-frequency raw telemetry data after a configurable retention period while
preserving aggregated rollup data for historical review.

## 4. Data Access

### 4.1 Role-Based Access Control

Access to data within FirePulse is controlled by a role-based permission system:

- **Admin** — Full access to all data and system configuration, including user
  management and audit logs
- **Instructor** — Access to session management, participant data, device
  management, and training operations
- **Medical** — Access to view session and participant data; full access to rehab
  management and vital sign recording

### 4.2 Authentication

All access requires authentication via username and password. Sessions are
managed via JSON Web Tokens (JWT) with configurable expiration.

### 4.3 Audit Logging

The Software maintains an audit log of significant user actions for
accountability and compliance purposes.

## 5. Biometric Data Notice

FirePulse collects biometric data in the form of heart rate measurements. The
Operator is responsible for:

- **Informing participants** that their heart rate and vital signs will be
  monitored and recorded during training
- **Obtaining any required consent** under applicable federal, state, and local
  laws governing the collection of biometric data
- **Compliance** with all applicable biometric data protection laws, including
  but not limited to:
  - New York Labor Law and Civil Rights Law provisions regarding biometric data
  - Any applicable state biometric privacy statutes
  - HIPAA, to the extent it applies to the Operator's activities
- **Establishing policies** for the access, retention, and disposal of biometric
  data

**The Copyright Holder does not collect, access, receive, or process any
biometric data.** All biometric data remains under the exclusive control of the
Operator.

## 6. Network and Infrastructure Security

FirePulse is designed for deployment on local, isolated, or private networks. The
Operator is solely responsible for:

- Network security and access control
- Firewall and network segmentation configuration
- Physical security of servers and network equipment
- Encryption of data at rest and in transit (if required by policy or regulation)
- Regular security updates to the operating system and dependencies
- Database access controls and backup procedures

## 7. Third-Party Data Sharing

FirePulse does not share data with third parties. The Software:

- Does not include analytics or tracking services
- Does not transmit data to external APIs or cloud services
- Does not include advertising or marketing integrations
- Does not phone home or check for updates

Any data export (e.g., CSV session exports) is initiated solely by the Operator
and remains under the Operator's control.

## 8. Data Subject Rights

The Operator is responsible for responding to any requests from participants or
other data subjects regarding their personal data, including requests to:

- Access their data
- Correct inaccurate data
- Delete their data
- Restrict processing of their data

The Software provides administrative tools to view, modify, and archive
participant records.

## 9. Children's Data

FirePulse is not intended for use with minors. If the Operator's training
programs include participants under 18, the Operator is solely responsible for
compliance with all applicable laws regarding the collection of data from minors.

## 10. Changes to This Policy

The Copyright Holder reserves the right to update this Privacy Policy. Changes
will be reflected in the "Last Updated" date above.

## 11. Contact

For questions regarding this Privacy Policy, contact the Copyright Holder.
