SET NOCOUNT ON;
GO

IF DB_ID(N'ResQ') IS NULL
BEGIN
  CREATE DATABASE ResQ;
END
GO

USE ResQ;
GO

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Users (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Email VARCHAR(255) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    Role VARCHAR(20) NOT NULL,
    Name VARCHAR(120) NULL,
    Phone VARCHAR(40) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT CK_Users_Role CHECK (Role IN ('User', 'Provider', 'Admin'))
  );
END
GO

IF OBJECT_ID(N'dbo.Providers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Providers (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL UNIQUE,
    Name VARCHAR(200) NOT NULL,
    Phone VARCHAR(50) NOT NULL,
    ServiceRadiusKm INT NOT NULL DEFAULT 20,
    BaseFee DECIMAL(10,2) NOT NULL DEFAULT 5000,
    PerKmFee DECIMAL(10,2) NOT NULL DEFAULT 350,
    IsOnline BIT NOT NULL DEFAULT 0,
    LastLat DECIMAL(10,6) NULL,
    LastLng DECIMAL(10,6) NULL,
    LastSeenAt DATETIME2 NULL,
    LastLocationAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_Providers_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END
GO

IF OBJECT_ID(N'dbo.ProviderCapabilities', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProviderCapabilities (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ProviderId INT NOT NULL,
    Capability VARCHAR(100) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_ProviderCapabilities_Providers FOREIGN KEY (ProviderId) REFERENCES dbo.Providers(Id),
    CONSTRAINT UQ_ProviderCapabilities UNIQUE (ProviderId, Capability)
  );
END
GO

IF OBJECT_ID(N'dbo.ServiceRequests', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ServiceRequests (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    SelectedProviderId INT NULL,
    PickupLat DECIMAL(10,6) NOT NULL,
    PickupLng DECIMAL(10,6) NOT NULL,
    PickupAddress VARCHAR(255) NULL,
    DestinationLat DECIMAL(10,6) NULL,
    DestinationLng DECIMAL(10,6) NULL,
    DestinationAddress VARCHAR(255) NULL,
    ProblemType VARCHAR(100) NULL,
    Notes VARCHAR(500) NULL,
    Status VARCHAR(20) NOT NULL DEFAULT 'new',
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_ServiceRequests_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id),
    CONSTRAINT FK_ServiceRequests_Providers FOREIGN KEY (SelectedProviderId) REFERENCES dbo.Providers(Id),
    CONSTRAINT CK_ServiceRequests_Status CHECK (Status IN ('new', 'accepted', 'cancelled', 'completed'))
  );
END
GO

IF COL_LENGTH('dbo.ServiceRequests', 'DestinationLat') IS NULL
  ALTER TABLE dbo.ServiceRequests ADD DestinationLat DECIMAL(10,6) NULL;
GO
IF COL_LENGTH('dbo.ServiceRequests', 'DestinationLng') IS NULL
  ALTER TABLE dbo.ServiceRequests ADD DestinationLng DECIMAL(10,6) NULL;
GO
IF COL_LENGTH('dbo.ServiceRequests', 'DestinationAddress') IS NULL
  ALTER TABLE dbo.ServiceRequests ADD DestinationAddress VARCHAR(255) NULL;
GO

IF OBJECT_ID(N'dbo.Offers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Offers (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    RequestId INT NOT NULL,
    ProviderId INT NOT NULL,
    OfferedPrice DECIMAL(10,2) NOT NULL,
    EtaMinutes INT NULL,
    Message VARCHAR(500) NULL,
    Status VARCHAR(20) NOT NULL DEFAULT 'open',
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_Offers_Requests FOREIGN KEY (RequestId) REFERENCES dbo.ServiceRequests(Id),
    CONSTRAINT FK_Offers_Providers FOREIGN KEY (ProviderId) REFERENCES dbo.Providers(Id),
    CONSTRAINT CK_Offers_Status CHECK (Status IN ('open', 'accepted', 'rejected'))
  );
END
GO

IF OBJECT_ID(N'dbo.Jobs', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Jobs (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    RequestId INT NOT NULL,
    ProviderId INT NOT NULL,
    Status VARCHAR(20) NOT NULL DEFAULT 'accepted',
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_Jobs_Requests FOREIGN KEY (RequestId) REFERENCES dbo.ServiceRequests(Id),
    CONSTRAINT FK_Jobs_Providers FOREIGN KEY (ProviderId) REFERENCES dbo.Providers(Id),
    CONSTRAINT CK_Jobs_Status CHECK (Status IN ('accepted', 'enroute', 'arrived', 'completed', 'cancelled'))
  );
END
GO

IF OBJECT_ID(N'dbo.Ratings', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Ratings (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    JobId INT NOT NULL,
    UserId INT NOT NULL,
    Stars INT NOT NULL,
    Comment VARCHAR(500) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_Ratings_Jobs FOREIGN KEY (JobId) REFERENCES dbo.Jobs(Id),
    CONSTRAINT FK_Ratings_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id),
    CONSTRAINT CK_Ratings_Stars CHECK (Stars BETWEEN 1 AND 5)
  );
END
GO

IF OBJECT_ID(N'dbo.PasswordResetTokens', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.PasswordResetTokens (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    TokenHash VARCHAR(128) NOT NULL UNIQUE,
    ExpiresAt DATETIME2 NOT NULL,
    UsedAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_PasswordResetTokens_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id) ON DELETE CASCADE
  );
END
GO

IF OBJECT_ID(N'dbo.SupportConversations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SupportConversations (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ParticipantUserId INT NOT NULL,
    Status VARCHAR(20) NOT NULL DEFAULT 'open',
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_SupportConversations_Users FOREIGN KEY (ParticipantUserId) REFERENCES dbo.Users(Id),
    CONSTRAINT CK_SupportConversations_Status CHECK (Status IN ('open', 'closed'))
  );
END
GO

IF OBJECT_ID(N'dbo.SupportMessages', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SupportMessages (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ConversationId INT NOT NULL,
    SenderUserId INT NOT NULL,
    Body VARCHAR(2000) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_SupportMessages_Conversations FOREIGN KEY (ConversationId) REFERENCES dbo.SupportConversations(Id) ON DELETE CASCADE,
    CONSTRAINT FK_SupportMessages_Users FOREIGN KEY (SenderUserId) REFERENCES dbo.Users(Id)
  );
END
GO

IF OBJECT_ID(N'dbo.RequestMessages', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.RequestMessages (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    RequestId INT NOT NULL,
    SenderUserId INT NOT NULL,
    Body VARCHAR(2000) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_RequestMessages_Requests FOREIGN KEY (RequestId) REFERENCES dbo.ServiceRequests(Id) ON DELETE CASCADE,
    CONSTRAINT FK_RequestMessages_Users FOREIGN KEY (SenderUserId) REFERENCES dbo.Users(Id)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Providers_OnlineLocation' AND object_id = OBJECT_ID('dbo.Providers'))
  CREATE INDEX IX_Providers_OnlineLocation ON dbo.Providers (IsOnline, LastLat, LastLng);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ServiceRequests_StatusCreated' AND object_id = OBJECT_ID('dbo.ServiceRequests'))
  CREATE INDEX IX_ServiceRequests_StatusCreated ON dbo.ServiceRequests (Status, CreatedAt);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Offers_RequestProvider' AND object_id = OBJECT_ID('dbo.Offers'))
  CREATE INDEX IX_Offers_RequestProvider ON dbo.Offers (RequestId, ProviderId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ProviderCapabilities_Provider' AND object_id = OBJECT_ID('dbo.ProviderCapabilities'))
  CREATE INDEX IX_ProviderCapabilities_Provider ON dbo.ProviderCapabilities (ProviderId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PasswordResetTokens_UserId' AND object_id = OBJECT_ID('dbo.PasswordResetTokens'))
  CREATE INDEX IX_PasswordResetTokens_UserId ON dbo.PasswordResetTokens (UserId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SupportConversations_ParticipantStatus' AND object_id = OBJECT_ID('dbo.SupportConversations'))
  CREATE INDEX IX_SupportConversations_ParticipantStatus ON dbo.SupportConversations (ParticipantUserId, Status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SupportMessages_ConversationCreated' AND object_id = OBJECT_ID('dbo.SupportMessages'))
  CREATE INDEX IX_SupportMessages_ConversationCreated ON dbo.SupportMessages (ConversationId, CreatedAt);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RequestMessages_RequestCreated' AND object_id = OBJECT_ID('dbo.RequestMessages'))
  CREATE INDEX IX_RequestMessages_RequestCreated ON dbo.RequestMessages (RequestId, CreatedAt);
GO

DECLARE @adminEmail VARCHAR(255) = 'admin@test.hu';
DECLARE @userEmail VARCHAR(255) = 'tesztauto@test.hu';
DECLARE @providerEmail VARCHAR(255) = 'tesztmento@test.hu';

DECLARE @adminHash VARCHAR(255) = '$2b$10$7UH/5GtCrb1Gy4yOOv6W7etbCq/7VyMwy0UbTPE3oFPtLZ96Qw0uu'; -- admin123
DECLARE @testHash  VARCHAR(255) = '$2b$10$AvPyzhXRR6h7CrcpvVk.4Ontd6Y6LvOct1d9fFtKL36s2MnDRSl6O'; -- teszt123

MERGE dbo.Users AS t
USING (SELECT @adminEmail AS Email, @adminHash AS PasswordHash, 'Admin' AS Role, 'Admin' AS Name, NULL AS Phone) AS s
ON t.Email = s.Email
WHEN MATCHED THEN
  UPDATE SET t.PasswordHash = s.PasswordHash, t.Role = s.Role, t.Name = s.Name, t.Phone = s.Phone, t.UpdatedAt = GETUTCDATE()
WHEN NOT MATCHED THEN
  INSERT (Email, PasswordHash, Role, Name, Phone) VALUES (s.Email, s.PasswordHash, s.Role, s.Name, s.Phone);

MERGE dbo.Users AS t
USING (SELECT @userEmail AS Email, @testHash AS PasswordHash, 'User' AS Role, 'Teszt Autós' AS Name, '+36 70 611 4311' AS Phone) AS s
ON t.Email = s.Email
WHEN MATCHED THEN
  UPDATE SET t.PasswordHash = s.PasswordHash, t.Role = s.Role, t.Name = s.Name, t.Phone = s.Phone, t.UpdatedAt = GETUTCDATE()
WHEN NOT MATCHED THEN
  INSERT (Email, PasswordHash, Role, Name, Phone) VALUES (s.Email, s.PasswordHash, s.Role, s.Name, s.Phone);

MERGE dbo.Users AS t
USING (SELECT @providerEmail AS Email, @testHash AS PasswordHash, 'Provider' AS Role, 'Teszt Autómentő' AS Name, '+36 30 000 0000' AS Phone) AS s
ON t.Email = s.Email
WHEN MATCHED THEN
  UPDATE SET t.PasswordHash = s.PasswordHash, t.Role = s.Role, t.Name = s.Name, t.Phone = s.Phone, t.UpdatedAt = GETUTCDATE()
WHEN NOT MATCHED THEN
  INSERT (Email, PasswordHash, Role, Name, Phone) VALUES (s.Email, s.PasswordHash, s.Role, s.Name, s.Phone);
GO

DECLARE @providerUserId INT;
SELECT TOP 1 @providerUserId = Id FROM dbo.Users WHERE Email = 'tesztmento@test.hu';

IF @providerUserId IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.Providers WHERE UserId = @providerUserId)
  BEGIN
    UPDATE dbo.Providers
    SET
      Name = 'Teszt Autómentő',
      Phone = '+36 30 000 0000',
      ServiceRadiusKm = 25,
      BaseFee = 5000,
      PerKmFee = 350,
      UpdatedAt = GETUTCDATE()
    WHERE UserId = @providerUserId;
  END
  ELSE
  BEGIN
    INSERT INTO dbo.Providers (
      UserId, Name, Phone, ServiceRadiusKm, BaseFee, PerKmFee, IsOnline, LastSeenAt
    )
    VALUES (
      @providerUserId, 'Teszt Autómentő', '+36 30 000 0000', 25, 5000, 350, 0, GETUTCDATE()
    );
  END
END
GO

PRINT 'ResQ setup kész. Alap felhasználók: admin@test.hu, tesztauto@test.hu, tesztmento@test.hu';
GO
