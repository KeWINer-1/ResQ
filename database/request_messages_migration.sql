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
