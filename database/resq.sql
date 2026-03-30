CREATE DATABASE ResQ;
GO

USE ResQ;
GO

CREATE TABLE Users (
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

CREATE TABLE Providers (
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
  CONSTRAINT FK_Providers_Users FOREIGN KEY (UserId) REFERENCES Users(Id)
);

CREATE TABLE ProviderCapabilities (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProviderId INT NOT NULL,
  Capability VARCHAR(100) NOT NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  CONSTRAINT FK_ProviderCapabilities_Providers FOREIGN KEY (ProviderId) REFERENCES Providers(Id),
  CONSTRAINT UQ_ProviderCapabilities UNIQUE (ProviderId, Capability)
);

CREATE TABLE ServiceRequests (
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
  CONSTRAINT FK_ServiceRequests_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
  CONSTRAINT FK_ServiceRequests_Providers FOREIGN KEY (SelectedProviderId) REFERENCES Providers(Id),
  CONSTRAINT CK_ServiceRequests_Status CHECK (Status IN ('new', 'accepted', 'cancelled', 'completed'))
);

CREATE TABLE Offers (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  RequestId INT NOT NULL,
  ProviderId INT NOT NULL,
  OfferedPrice DECIMAL(10,2) NOT NULL,
  EtaMinutes INT NULL,
  Message VARCHAR(500) NULL,
  Status VARCHAR(20) NOT NULL DEFAULT 'open',
  CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  CONSTRAINT FK_Offers_Requests FOREIGN KEY (RequestId) REFERENCES ServiceRequests(Id),
  CONSTRAINT FK_Offers_Providers FOREIGN KEY (ProviderId) REFERENCES Providers(Id),
  CONSTRAINT CK_Offers_Status CHECK (Status IN ('open', 'accepted', 'rejected'))
);

CREATE TABLE Jobs (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  RequestId INT NOT NULL,
  ProviderId INT NOT NULL,
  Status VARCHAR(20) NOT NULL DEFAULT 'accepted',
  CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  CONSTRAINT FK_Jobs_Requests FOREIGN KEY (RequestId) REFERENCES ServiceRequests(Id),
  CONSTRAINT FK_Jobs_Providers FOREIGN KEY (ProviderId) REFERENCES Providers(Id),
  CONSTRAINT CK_Jobs_Status CHECK (Status IN ('accepted', 'enroute', 'arrived', 'completed', 'cancelled'))
);

CREATE TABLE Ratings (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  JobId INT NOT NULL,
  UserId INT NOT NULL,
  Stars INT NOT NULL,
  Comment VARCHAR(500) NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  CONSTRAINT FK_Ratings_Jobs FOREIGN KEY (JobId) REFERENCES Jobs(Id),
  CONSTRAINT FK_Ratings_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
  CONSTRAINT CK_Ratings_Stars CHECK (Stars BETWEEN 1 AND 5)
);

CREATE INDEX IX_Providers_OnlineLocation ON Providers (IsOnline, LastLat, LastLng);
CREATE INDEX IX_ServiceRequests_StatusCreated ON ServiceRequests (Status, CreatedAt);
CREATE INDEX IX_Offers_RequestProvider ON Offers (RequestId, ProviderId);
CREATE INDEX IX_ProviderCapabilities_Provider ON ProviderCapabilities (ProviderId);

CREATE TABLE PasswordResetTokens (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  UserId INT NOT NULL,
  TokenHash VARCHAR(128) NOT NULL UNIQUE,
  ExpiresAt DATETIME2 NOT NULL,
  UsedAt DATETIME2 NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  CONSTRAINT FK_PasswordResetTokens_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE INDEX IX_PasswordResetTokens_UserId ON PasswordResetTokens (UserId);

CREATE TABLE SupportConversations (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ParticipantUserId INT NOT NULL,
  Status VARCHAR(20) NOT NULL DEFAULT 'open',
  CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  CONSTRAINT FK_SupportConversations_Users FOREIGN KEY (ParticipantUserId) REFERENCES Users(Id),
  CONSTRAINT CK_SupportConversations_Status CHECK (Status IN ('open', 'closed'))
);

CREATE TABLE SupportMessages (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ConversationId INT NOT NULL,
  SenderUserId INT NOT NULL,
  Body VARCHAR(2000) NOT NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  CONSTRAINT FK_SupportMessages_Conversations FOREIGN KEY (ConversationId) REFERENCES SupportConversations(Id) ON DELETE CASCADE,
  CONSTRAINT FK_SupportMessages_Users FOREIGN KEY (SenderUserId) REFERENCES Users(Id)
);

CREATE INDEX IX_SupportConversations_ParticipantStatus ON SupportConversations (ParticipantUserId, Status);
CREATE INDEX IX_SupportMessages_ConversationCreated ON SupportMessages (ConversationId, CreatedAt);

CREATE TABLE RequestMessages (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  RequestId INT NOT NULL,
  SenderUserId INT NOT NULL,
  Body VARCHAR(2000) NOT NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
  CONSTRAINT FK_RequestMessages_Requests FOREIGN KEY (RequestId) REFERENCES ServiceRequests(Id) ON DELETE CASCADE,
  CONSTRAINT FK_RequestMessages_Users FOREIGN KEY (SenderUserId) REFERENCES Users(Id)
);

CREATE INDEX IX_RequestMessages_RequestCreated ON RequestMessages (RequestId, CreatedAt);
GO
