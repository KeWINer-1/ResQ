IF COL_LENGTH('ServiceRequests', 'DestinationLat') IS NULL
  ALTER TABLE ServiceRequests ADD DestinationLat DECIMAL(10,6) NULL;
IF COL_LENGTH('ServiceRequests', 'DestinationLng') IS NULL
  ALTER TABLE ServiceRequests ADD DestinationLng DECIMAL(10,6) NULL;
IF COL_LENGTH('ServiceRequests', 'DestinationAddress') IS NULL
  ALTER TABLE ServiceRequests ADD DestinationAddress VARCHAR(255) NULL;
