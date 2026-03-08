@echo off
echo ============================================
echo  FirePulse Project Setup
echo ============================================
echo.

set SRC=C:\Users\tomze\Heartbeat
set DST=C:\Users\tomze\FirePulse

echo Copying packages\shared...
xcopy "%SRC%\packages\shared" "%DST%\packages\shared" /E /I /Y /Q
echo.

echo Copying packages\backend...
xcopy "%SRC%\packages\backend" "%DST%\packages\backend" /E /I /Y /Q
echo.

echo Copying packages\frontend...
xcopy "%SRC%\packages\frontend" "%DST%\packages\frontend" /E /I /Y /Q
echo.

echo Copying legal files...
copy "%SRC%\LICENSE" "%DST%\LICENSE" /Y >nul
copy "%SRC%\TERMS_OF_SERVICE.md" "%DST%\TERMS_OF_SERVICE.md" /Y >nul
copy "%SRC%\DISCLAIMER.md" "%DST%\DISCLAIMER.md" /Y >nul
copy "%SRC%\PRIVACY_POLICY.md" "%DST%\PRIVACY_POLICY.md" /Y >nul
copy "%SRC%\THIRD_PARTY_NOTICES.md" "%DST%\THIRD_PARTY_NOTICES.md" /Y >nul
echo.

echo Copying .env file...
copy "%SRC%\.env" "%DST%\.env" /Y >nul 2>nul
copy "%SRC%\.env.example" "%DST%\.env.example" /Y >nul 2>nul
echo.

echo Copying icon...
if not exist "%DST%\resources" mkdir "%DST%\resources"
copy "%SRC%\scripts\firepulse.ico" "%DST%\resources\icon.ico" /Y >nul 2>nul
copy "%SRC%\packages\frontend\public\logo.png" "%DST%\resources\logo.png" /Y >nul 2>nul
echo.

echo ============================================
echo  Source files copied successfully!
echo.
echo  Next steps:
echo    1. Run the modifications (Claude will do this)
echo    2. npm install
echo    3. npx prisma generate
echo    4. npm run build
echo ============================================
pause
