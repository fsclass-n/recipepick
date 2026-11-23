"""외부 이미지를 S3로 미러링.

크롤러가 수집한 상품 이미지는 마트 사이트 URL을 핫링크하므로 referer 차단이나
원본 삭제로 깨질 수 있다. S3_BUCKET이 설정되면 이미지를 내려받아
`<prefix>/<url-hash>.<ext>`로 업로드하고 S3 URL을 반환한다. 미설정/실패 시
원본 URL을 그대로 돌려줘 서비스를 깨지 않는다(fail-open).

자격증명은 코드에 두지 않고 boto3 기본 체인을 따른다(EC2 인스턴스 IAM Role).
"""
import hashlib
import logging
import threading

import requests

from ..config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

_client = None
_lock = threading.Lock()

_EXT_BY_CONTENT_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
}


def _s3():
    global _client
    if _client is None:
        with _lock:
            if _client is None:
                import boto3

                _client = boto3.client("s3", region_name=settings.s3_region)
    return _client


def mirror_image_to_s3(url: str) -> str:
    """외부 이미지 URL을 S3로 복사하고 객체 URL을 반환. 실패 시 원본 반환."""
    if not settings.s3_bucket or not url.startswith(("http://", "https://")):
        return url
    if settings.s3_bucket in url:  # 이미 S3 URL
        return url
    try:
        resp = requests.get(url, timeout=10, headers={"User-Agent": "RecipePick-ImageMirror/1.0"})
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "").split(";")[0].strip().lower()
        ext = _EXT_BY_CONTENT_TYPE.get(content_type)
        if ext is None:
            return url  # 이미지가 아닌 응답이면 미러링하지 않음
        key = f"{settings.s3_prefix}/{hashlib.sha256(url.encode()).hexdigest()[:20]}{ext}"
        _s3().put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=resp.content,
            ContentType=content_type,
            CacheControl="public, max-age=31536000, immutable",
        )
        return f"https://{settings.s3_bucket}.s3.{settings.s3_region}.amazonaws.com/{key}"
    except Exception as exc:
        logger.warning("S3 image mirror failed for %s: %s", url, exc)
        return url
