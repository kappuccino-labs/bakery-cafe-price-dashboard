@echo off
echo ================================================
echo  BreadAlert EC2 자동 업로드 스케줄러 등록
echo ================================================
echo.

set WORK_DIR=C:\Users\Admin\mcp-servers\.claude\worktrees\bold-noyce\google-youtube-trend-collector

echo [1] 기존 작업 삭제 (있으면)...
schtasks /delete /tn "BreadAlert_AM" /f 2>nul
schtasks /delete /tn "BreadAlert_PM" /f 2>nul
echo.

echo [2] 오전 09:00 스케줄 등록...
schtasks /create /tn "BreadAlert_AM" /tr "\"%WORK_DIR%\schedule-am.bat\"" /sc daily /st 09:00 /rl HIGHEST /f
echo.

echo [3] 오후 18:00 스케줄 등록...
schtasks /create /tn "BreadAlert_PM" /tr "\"%WORK_DIR%\schedule-pm.bat\"" /sc daily /st 18:00 /rl HIGHEST /f
echo.

echo [4] 등록 확인...
schtasks /query /tn "BreadAlert_AM" /fo LIST
echo.
schtasks /query /tn "BreadAlert_PM" /fo LIST
echo.

echo ================================================
echo  완료! 매일 오전 9시, 오후 6시에 자동 실행됩니다.
echo ================================================
pause
