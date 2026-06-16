# backend/app/services/connections/__init__.py
"""Google Workspace connector: full OAuth + encrypted token vault + Drive ingest.

Public surface:
  - GoogleOAuth        : authorization-code flow (build url, exchange, refresh, revoke)
  - TokenVault         : envelope-encrypted storage/retrieval of refresh tokens
  - DriveConnector     : list metadata for picked file ids, fetch+route bytes to ingest
  - WatchManager       : register / stop Drive push-notification channels
  - LiveSyncService    : enable, disable, renew, resolve and apply Drive changes
"""
from .oauth import GoogleOAuth
from .vault import TokenVault
from .drive import DriveConnector
from .watch import WatchManager
from .livesync import LiveSyncService

__all__ = ["GoogleOAuth", "TokenVault", "DriveConnector", "WatchManager", "LiveSyncService"]
