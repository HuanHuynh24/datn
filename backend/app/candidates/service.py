from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.candidates.repository import CandidateProfileRepository
from app.candidates.schemas import ProfileResponse, ProfileUpdate


class ProfileNotFound(Exception):
    pass


class InvalidProfile(Exception):
    pass


class CandidateProfileService:
    def __init__(self, session: Session):
        self.session = session
        self.repository = CandidateProfileRepository(session)

    @staticmethod
    def response(row) -> ProfileResponse:
        if row is None:
            raise ProfileNotFound()
        values = dict(row)
        for key in ("account_id", "candidate_id", "province_id"):
            values[key] = str(values[key]) if values[key] is not None else None
        values["updated_at"] = values["updated_at"].replace(tzinfo=UTC)
        return ProfileResponse(**values)

    def get(self, account_id: str) -> ProfileResponse:
        return self.response(self.repository.owned(account_id))

    def update(self, account_id: str, request: ProfileUpdate) -> ProfileResponse:
        # Principal resolution has already begun this request's transaction.
        # Lock before merging PATCH values; commit both account/profile together.
        current = self.repository.owned(account_id, lock=True)
        if current is None:
            raise ProfileNotFound()
        values = request.model_dump(exclude_unset=True)
        minimum = values.get("minimum_salary", current["minimum_salary"])
        maximum = values.get("maximum_salary", current["maximum_salary"])
        if minimum is not None and maximum is not None and minimum > maximum:
            raise InvalidProfile("minimum_salary must not exceed maximum_salary")
        province = values.get("province_id")
        if province is not None:
            if not self.repository.province_exists(province):
                raise InvalidProfile("province_id does not exist")
            values["province_id"] = int(province)
        if values.get("avatar_url") is not None:
            values["avatar_url"] = str(values["avatar_url"])
        if values:
            self.repository.update_owned(account_id, values, datetime.now(UTC).replace(tzinfo=None))
        result = self.get(account_id)
        self.session.commit()
        return result
