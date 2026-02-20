@echo off
cd /d "C:\Users\Admin\mcp-servers\.claude\worktrees\bold-noyce\google-youtube-trend-collector"
npx tsx src/scheduled-sync.ts pm >> sync-log.txt 2>&1
