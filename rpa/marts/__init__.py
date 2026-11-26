from .emart import EmartCrawler
from .homeplus import HomeplusCrawler
from .lottemart import LotteMartCrawler
from .oasis import OasisCrawler

CRAWLERS = [EmartCrawler(), LotteMartCrawler(), HomeplusCrawler(), OasisCrawler()]

__all__ = ["CRAWLERS", "EmartCrawler", "LotteMartCrawler", "HomeplusCrawler", "OasisCrawler"]
