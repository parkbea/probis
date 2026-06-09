@echo off
chcp 65001 >nul
echo ============================================
echo   python-pptx 오프라인 설치
echo   (인터넷 없이 packages 폴더에서 설치)
echo ============================================
echo.

cd /d "%~dp0"

where python >nul 2>&1
if errorlevel 1 (
    echo [오류] Python이 설치되어 있지 않습니다.
    pause
    exit /b 1
)

echo Python 버전:
python --version
echo.

echo packages 폴더에서 오프라인 설치 중...
python -m pip install --no-index --find-links=packages python-pptx

echo.
if %ERRORLEVEL% == 0 (
    echo ============================================
    echo   설치 완료!
    echo   서버를 재시작하면 PPT 생성이 활성화됩니다.
    echo ============================================
    python -c "from pptx import Presentation; print('  확인: python-pptx 정상 동작')"
) else (
    echo ============================================
    echo   [설치 실패] Python 버전을 확인하세요.
    echo   패키지는 Python 3.12 / Windows 64bit 용입니다.
    echo ============================================
)

echo.
pause
