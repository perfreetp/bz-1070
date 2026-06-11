import sequelize from './index';
import User from '../models/User';
import Organization from '../models/Organization';
import Child from '../models/Child';
import Device from '../models/Device';
import Location from '../models/Location';
import Geofence from '../models/Geofence';
import Alert from '../models/Alert';
import Guardian from '../models/Guardian';
import RescueLink from '../models/RescueLink';
import CheckInRecord from '../models/CheckInRecord';
import AlertPush from '../models/AlertPush';

Organization.hasMany(User, { foreignKey: 'organizationId', as: 'users' });
User.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

Organization.hasMany(Child, { foreignKey: 'organizationId', as: 'children' });
Child.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

Child.hasMany(Device, { foreignKey: 'childId', as: 'devices' });
Device.belongsTo(Child, { foreignKey: 'childId', as: 'child' });

Device.hasMany(Location, { foreignKey: 'deviceId', as: 'locations' });
Location.belongsTo(Device, { foreignKey: 'deviceId', as: 'device' });
Child.hasMany(Location, { foreignKey: 'childId', as: 'locations' });
Location.belongsTo(Child, { foreignKey: 'childId', as: 'child' });

Child.hasMany(Geofence, { foreignKey: 'childId', as: 'geofences' });
Geofence.belongsTo(Child, { foreignKey: 'childId', as: 'child' });
Organization.hasMany(Geofence, { foreignKey: 'organizationId', as: 'geofences' });
Geofence.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
User.hasMany(Geofence, { foreignKey: 'createdBy', as: 'createdGeofences' });
Geofence.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

Child.hasMany(Alert, { foreignKey: 'childId', as: 'alerts' });
Alert.belongsTo(Child, { foreignKey: 'childId', as: 'child' });
Device.hasMany(Alert, { foreignKey: 'deviceId', as: 'alerts' });
Alert.belongsTo(Device, { foreignKey: 'deviceId', as: 'device' });
Geofence.hasMany(Alert, { foreignKey: 'geofenceId', as: 'alerts' });
Alert.belongsTo(Geofence, { foreignKey: 'geofenceId', as: 'geofence' });
User.hasMany(Alert, { foreignKey: 'handledBy', as: 'handledAlerts' });
Alert.belongsTo(User, { foreignKey: 'handledBy', as: 'handler' });

Child.hasMany(Guardian, { foreignKey: 'childId', as: 'guardians' });
Guardian.belongsTo(Child, { foreignKey: 'childId', as: 'child' });
User.hasMany(Guardian, { foreignKey: 'userId', as: 'guardedChildren' });
Guardian.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Guardian, { foreignKey: 'authorizedBy', as: 'authorizedGuardians' });
Guardian.belongsTo(User, { foreignKey: 'authorizedBy', as: 'authorizer' });

Child.hasMany(RescueLink, { foreignKey: 'childId', as: 'rescueLinks' });
RescueLink.belongsTo(Child, { foreignKey: 'childId', as: 'child' });
Alert.hasMany(RescueLink, { foreignKey: 'alertId', as: 'rescueLinks' });
RescueLink.belongsTo(Alert, { foreignKey: 'alertId', as: 'alert' });
User.hasMany(RescueLink, { foreignKey: 'createdBy', as: 'createdRescueLinks' });
RescueLink.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

Child.hasMany(CheckInRecord, { foreignKey: 'childId', as: 'checkInRecords' });
CheckInRecord.belongsTo(Child, { foreignKey: 'childId', as: 'child' });
Organization.hasMany(CheckInRecord, { foreignKey: 'organizationId', as: 'checkInRecords' });
CheckInRecord.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
Device.hasMany(CheckInRecord, { foreignKey: 'deviceId', as: 'checkInRecords' });
CheckInRecord.belongsTo(Device, { foreignKey: 'deviceId', as: 'device' });
Guardian.hasMany(CheckInRecord, { foreignKey: 'guardianId', as: 'checkInRecords' });
CheckInRecord.belongsTo(Guardian, { foreignKey: 'guardianId', as: 'guardian' });
User.hasMany(CheckInRecord, { foreignKey: 'verifiedBy', as: 'verifiedCheckIns' });
CheckInRecord.belongsTo(User, { foreignKey: 'verifiedBy', as: 'verifier' });

Alert.hasMany(AlertPush, { foreignKey: 'alertId', as: 'pushes' });
AlertPush.belongsTo(Alert, { foreignKey: 'alertId', as: 'alert' });
Guardian.hasMany(AlertPush, { foreignKey: 'guardianId', as: 'alertPushes' });
AlertPush.belongsTo(Guardian, { foreignKey: 'guardianId', as: 'guardian' });
User.hasMany(AlertPush, { foreignKey: 'userId', as: 'alertPushes' });
AlertPush.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export {
  sequelize,
  User,
  Organization,
  Child,
  Device,
  Location,
  Geofence,
  Alert,
  Guardian,
  RescueLink,
  CheckInRecord,
  AlertPush
};
