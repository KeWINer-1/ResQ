-- Run this on an existing ResQ database to add the admin support chat tables.
-- (New installs are covered by database/resq.sql.)

IF OBJECT_ID('dbo.PasswordResetTokens', 'U') IS NULL
BEGIN
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
END
GO

IF OBJECT_ID('dbo.SupportConversations', 'U') IS NULL
BEGIN
  CREATE TABLE SupportConversations (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ParticipantUserId INT NOT NULL,
    Status VARCHAR(20) NOT NULL DEFAULT 'open',
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_SupportConversations_Users FOREIGN KEY (ParticipantUserId) REFERENCES Users(Id),
    CONSTRAINT CK_SupportConversations_Status CHECK (Status IN ('open', 'closed'))
  );

  CREATE INDEX IX_SupportConversations_ParticipantStatus ON SupportConversations (ParticipantUserId, Status);
END
GO

IF OBJECT_ID('dbo.SupportMessages', 'U') IS NULL
BEGIN
  CREATE TABLE SupportMessages (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ConversationId INT NOT NULL,
    SenderUserId INT NOT NULL,
    Body VARCHAR(2000) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_SupportMessages_Conversations FOREIGN KEY (ConversationId) REFERENCES SupportConversations(Id) ON DELETE CASCADE,
    CONSTRAINT FK_SupportMessages_Users FOREIGN KEY (SenderUserId) REFERENCES Users(Id)
  );

  CREATE INDEX IX_SupportMessages_ConversationCreated ON SupportMessages (ConversationId, CreatedAt);
END
GO

IF OBJECT_ID('dbo.RequestMessages', 'U') IS NULL
BEGIN
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
END
GO
